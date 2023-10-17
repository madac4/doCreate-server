import { NextFunction, Request, Response } from 'express';
import { CatchAsyncErrors } from './catchAsyncErrors';
import TeamModel from '../models/Team.model';
import ErrorHandler from '../utils/ErrorHandler';

export const isTeamAdmin = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teamId = req.params.id;
            const userId = req.user?._id;

            const team = await TeamModel.findById(teamId);

            if (!team) {
                return next(new ErrorHandler('Team not found', 404));
            }

            if (team.admin.toString() !== userId) {
                return next(new ErrorHandler('You are not allowed to access this team', 403));
            }

            req.team = team;
            next();
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

export const isTeamMember = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teamId = req.params.id;
            const userId = req.user?._id;

            const team = await TeamModel.findById(teamId);

            if (!team) {
                return next(new ErrorHandler('Team not found', 404));
            }

            if (!team.members.includes(userId)) {
                return next(new ErrorHandler('You are not allowed to access this team', 403));
            }

            req.team = team;
            next();
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);
