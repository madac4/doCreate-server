import { NextFunction, Request, Response } from 'express';
import { CatchAsyncErrors } from './catchAsyncErrors';
import ErrorHandler from '../utils/ErrorHandler';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { redis } from '../utils/redis';
import TeamModel from '../models/Team.model';

export const isAuthenticated = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        const access_token = req.cookies.access_token;

        if (!access_token) {
            return next(new ErrorHandler('Login first to access this resource', 401));
        }

        const decoded = (await jwt.verify(
            access_token,
            process.env.ACCESS_TOKEN as string,
        )) as JwtPayload;

        if (!decoded) {
            return next(new ErrorHandler('Access token is invalid', 401));
        }

        const user = await redis.get(decoded.id);

        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        req.user = JSON.parse(user);
        next();
    },
);
