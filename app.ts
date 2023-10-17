import express, { Response, Request, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ErrorMiddleware } from './middleware/error';
import userRouter from './routes/user.routes';
import teamRouter from './routes/team.routes';
require('dotenv').config();

export const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(
    cors({
        origin: process.env.ORIGIN,
        credentials: true,
    }),
);

app.use('/api/v1/', userRouter);
app.use('/api/v1/', teamRouter);

app.get('/testing', (req: Request, res: Response, next: NextFunction) => {
    res.status(200).json({ success: true, message: 'Server is running' });
});

app.all('*', (req: Request, res: Response, next: NextFunction) => {
    const err = new Error(`Route ${req.originalUrl} not found`) as Error & { statusCode: number };
    err.statusCode = 404;
    next(err);
});

app.use(ErrorMiddleware);
