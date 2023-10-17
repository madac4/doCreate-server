import { NextFunction, Request, Response } from 'express';
import { CatchAsyncErrors } from '../middleware/catchAsyncErrors';
import TeamModel from '../models/Team.model';
import UserModel from '../models/User.model';
import ErrorHandler from '../utils/ErrorHandler';
import { redis } from '../utils/redis';

// CREATE TEAM
export const createTeam = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name } = req.body as { name: string };
            const userId = req.user?._id;

            if (!userId) {
                return next(new ErrorHandler('User not found', 404));
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
