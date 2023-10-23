import { NextFunction, Request, Response } from 'express';
import { CatchAsyncErrors } from '../middleware/catchAsyncErrors';
import TeamModel, { InvitationModel } from '../models/Team.model';
import UserModel from '../models/User.model';
import ErrorHandler from '../utils/ErrorHandler';
import { redis } from '../utils/redis';
import sendMail from '../utils/sendMail';
import jwt, { Secret } from 'jsonwebtoken';

// CREATE TEAM
export const createTeam = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name } = req.body as { name: string };
            const userId = req.user?._id;
            const teamExists = await TeamModel.findOne({ admin: userId, name });

            if (!name) {
                return next(new ErrorHandler('Enter team name', 400));
            }

            if (!userId) {
                return next(new ErrorHandler('User not found', 404));
            }

            if (teamExists) {
                return next(new ErrorHandler('Team already exists', 400));
            }

            const team = await TeamModel.create({
                name,
                admin: userId,
                members: [userId],
            });

            const user = await UserModel.findById(userId);

            user?.teams.push(team.id);
            await user?.save();
            await redis.set(userId, JSON.stringify(user));

            res.status(200).json({
                success: true,
                team,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// UPDATE TEAM INFO
export const editTeam = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = req.body;
            const teamName = data.name;

            if (!teamName) {
                return next(new ErrorHandler('Enter new team name', 400));
            }

            const teamId = req.team?.id;

            await TeamModel.findByIdAndUpdate(teamId, { name: teamName });
            res.status(200).json({
                success: true,
                message: 'Team updated successfully',
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// DELETE TEAM
export const deleteTeam = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name } = req.body as { name: string };
            const teamId = req.team?.id;
            const userId = req.user?._id;

            const team = await TeamModel.findById(teamId);
            const user = await UserModel.findById(userId);

            if (team?.name === name) {
                await TeamModel.findByIdAndDelete(teamId);
                user?.teams.splice(user?.teams.indexOf(teamId), 1);
                await user?.save();
                await redis.set(userId, JSON.stringify(user));
                res.status(200).json({
                    success: true,
                    message: 'Team deleted successfully',
                });
            } else {
                return next(new ErrorHandler('Incorrect team name', 404));
            }
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// GET TEAM MEMBERS
export const getMembers = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teamId = req.team?.id;

            const team = await TeamModel.findById(teamId).populate('members');

            res.status(200).json({
                success: true,
                members: team?.members,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// INVITE MEMBER
export const inviteMember = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const emailRegexPattern: RegExp = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
            const teamId = req.team?.id;
            const { email } = req.body as { email: string };
            const team = await TeamModel.findById(teamId);
            const user = await UserModel.findOne({ email });

            if (!email) {
                throw new ErrorHandler('Email is required', 400);
            } else if (!emailRegexPattern.test(email)) {
                throw new ErrorHandler('Invalid email', 400);
            }

            if (team?.members.includes(user?._id)) {
                throw new ErrorHandler('User already exists', 400);
            }

            if (user) {
                await TeamModel.updateOne({ _id: teamId }, { $push: { members: user?._id } });
                await UserModel.updateOne({ _id: user?._id }, { $push: { teams: team?.id } });
                res.status(200).json({
                    success: true,
                    message: 'Member added to team successfully',
                });
            } else {
                try {
                    const invitationToken = jwt.sign(
                        { team },
                        process.env.INVITATION_TOKEN as Secret,
                        {
                            expiresIn: '1d',
                        },
                    );

                    const data = { teamName: team?.name, invitationLink: invitationToken };
                    await sendMail({
                        email,
                        subject: 'Team Invitation',
                        template: 'invitation-mail.ejs',
                        data,
                    });

                    await InvitationModel.create({
                        email: email,
                        status: 'pending',
                        team: teamId,
                    });

                    res.status(200).json({
                        success: true,
                        message: 'Invitation sent successfully',
                        invitationToken,
                    });
                } catch (error: any) {
                    return next(new ErrorHandler(error.message, 400));
                }
            }
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// REMOVE MEMBER FROM TEAM
export const removeMember = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teamId = req.team?.id;
            const { userId } = req.body as { userId: string };

            await TeamModel.updateOne({ _id: teamId }, { $pull: { members: userId } });
            await UserModel.updateOne({ _id: userId }, { $pull: { teams: teamId } });

            res.status(200).json({
                success: true,
                message: 'Member removed from team successfully',
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);
