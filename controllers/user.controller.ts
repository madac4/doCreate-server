import { accessTokenOptions, refreshTokenOptions, sendToken } from '../utils/jwt';
import { CatchAsyncErrors } from '../middleware/catchAsyncErrors';
import { NextFunction, Request, Response } from 'express';
import UserModel, { IUser } from '../models/User.model';
import { getUserById } from '../services/user.service';
import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import ErrorHandler from '../utils/ErrorHandler';
import sendMail from '../utils/sendMail';
import { redis } from '../utils/redis';
import path from 'path';
import ejs from 'ejs';
import cloudinary from 'cloudinary';
import TeamModel, { ITeam, InvitationModel } from '../models/Team.model';

require('dotenv').config();

interface IRegistrationBody {
    name: string;
    email: string;
    password: string;
    avatar?: string;
    teamToken?: string;
}

interface IActivationToken {
    token: string;
    activationCode: string;
}

interface IActivationRequest {
    activation_token: string;
    activation_code: string;
}

interface ILoginRequest {
    email: string;
    password: string;
}

interface IUpdateUserInfo {
    name?: string;
    email?: string;
}

interface IUpdatePassword {
    oldPassword: string;
    newPassword: string;
}

interface IUpdateAvatar {
    avatar: string;
}

interface IResetPasswordRequest {
    email: string;
}

interface IResetPassword {
    resetToken: string;
    newPassword: string;
}

// REGISTER USER
export const registerUser = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name, email, password, teamToken } = req.body as IRegistrationBody;
            const emailExists = await UserModel.findOne({ email });
            if (emailExists) {
                return next(new ErrorHandler('Email already exists', 400));
            }

            if (teamToken) {
                const decoded = jwt.verify(teamToken, process.env.INVITATION_TOKEN as string) as {
                    team: ITeam;
                };

                const user = {
                    name,
                    email,
                    password,
                    teams: [decoded.team._id],
                } as IRegistrationBody;

                const activationToken = createActivationToken(user);
                const activationCode = activationToken.activationCode;
                const data = { user: { name: user.name }, activationCode };

                await ejs.renderFile(path.join(__dirname, '../mails/activation-mail.ejs'), data);

                try {
                    await sendMail({
                        email: user.email,
                        subject: 'Activate your account on doCreate',
                        template: 'activation-mail.ejs',
                        data,
                    });

                    res.status(200).json({
                        success: true,
                        message: `Please check your email: ${user.email} to activate your account`,
                        activationToken: activationToken.token,
                    });
                } catch (error: any) {
                    return next(new ErrorHandler(error.message, 400));
                }
            } else {
                const user = {
                    name,
                    email,
                    password,
                } as IRegistrationBody;

                const activationToken = createActivationToken(user);
                const activationCode = activationToken.activationCode;
                const data = { user: { name: user.name }, activationCode };

                await ejs.renderFile(path.join(__dirname, '../mails/activation-mail.ejs'), data);

                try {
                    await sendMail({
                        email: user.email,
                        subject: 'Activate your account on doCreate',
                        template: 'activation-mail.ejs',
                        data,
                    });

                    res.status(200).json({
                        success: true,
                        message: `Please check your email: ${user.email} to activate your account`,
                        activationToken: activationToken.token,
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

// ACTIVATE USER
export const activateUser = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { activation_token, activation_code } = req.body as IActivationRequest;
            const newUser: { user: IUser; activationCode: string } = jwt.verify(
                activation_token,
                process.env.ACTIVATION_TOKEN_SECRET as string,
            ) as { user: IUser; activationCode: string };

            if (newUser.activationCode !== activation_code) {
                return next(new ErrorHandler('Invalid activation code', 400));
            }

            const { email, name, password, teams } = newUser.user;

            const userExists = await UserModel.findOne({ email });

            if (userExists) {
                return next(new ErrorHandler('User already exists', 400));
            }

            const user = await UserModel.create({ email, name, password, teams });

            if (teams) {
                await TeamModel.updateOne(
                    { _id: { $in: teams } },
                    { $push: { members: user._id } },
                );

                await InvitationModel.updateOne({ email: email }, { status: 'accepted' });
            }

            res.status(200).json({
                success: true,
                message: 'User activated successfully',
                user,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// LOGIN USER
export const loginUser = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, password } = req.body as ILoginRequest;

            if (!email || !password) {
                return next(new ErrorHandler('Please enter email and password', 400));
            }

            const user = await UserModel.findOne({ email });
            if (!user) {
                return next(new ErrorHandler('Invalid email or password', 400));
            }

            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return next(new ErrorHandler('Invalid email or password', 400));
            }

            sendToken(user, 200, res);
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// LOGOUT USER
export const logoutUser = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.cookie('access_token', '', { maxAge: 1 });
            res.cookie('refresh_token', '', { maxAge: 1 });
            const userId = req.user?._id || '';
            redis.del(userId);

            res.status(200).json({
                success: true,
                message: 'Logged out',
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// UPDATE ACCESS TOKEN
export const updateAccessToken = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const refresh_token = req.cookies.refresh_token as string;

            const decoded = jwt.verify(
                refresh_token,
                process.env.REFRESH_TOKEN as string,
            ) as JwtPayload;
            const message = 'Could not update access token';

            if (!decoded) {
                return next(new ErrorHandler(message, 400));
            }

            const session = await redis.get(decoded.id as string);
            if (!session) {
                return next(new ErrorHandler(message, 400));
            }

            const user = JSON.parse(session);

            const accessToken = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN as string, {
                expiresIn: '5m',
            });

            const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN as string, {
                expiresIn: '7d',
            });

            req.user = user;
            res.cookie('access_token', accessToken, accessTokenOptions);
            res.cookie('refresh_token', refreshToken, refreshTokenOptions);

            res.status(200).json({
                success: true,
                accessToken,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// GET USER INFO
export const getUserInfo = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?._id;
            if (!userId) {
                return next(new ErrorHandler('User not found', 400));
            }

            getUserById(userId, res);
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// UPDATE USER INFO
export const updateUserInfo = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name, email } = req.body as IUpdateUserInfo;
            const userId = req.user?._id;

            const user = await UserModel.findById(userId);

            if (email && user) {
                const emailExists = await UserModel.findOne({ email });
                if (emailExists) {
                    return next(new ErrorHandler('Email already exists', 400));
                }

                user.email = email;
            }

            if (name && user) {
                user.name = name;
            }

            await user?.save();
            await redis.set(userId, JSON.stringify(user));

            res.status(200).json({
                success: true,
                message: 'User updated successfully',
                user,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// UPDATE USER PASSWORD
export const updatePassword = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { oldPassword, newPassword } = req.body as IUpdatePassword;
            if (!oldPassword || !newPassword) {
                return next(new ErrorHandler('Please enter old and new password', 400));
            }

            const user = await UserModel.findById(req.user?._id).select('+password');
            if (user?.password === undefined) {
                return next(new ErrorHandler('Invalid user', 404));
            }

            const isPasswordMatch = await user?.comparePassword(oldPassword);
            if (!isPasswordMatch) {
                return next(new ErrorHandler('Old password is incorrect', 400));
            }

            user.password = newPassword;
            await user?.save();
            redis.set(user?._id, JSON.stringify(user));

            res.status(200).json({
                success: true,
                message: 'Password updated successfully',
                user,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// UPDATE PROFILE PICTURE
export const updateProfilePicture = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { avatar } = req.body as IUpdateAvatar;
            const userId = req.user?._id;

            const user = await UserModel.findById(userId);

            if (avatar && user) {
                if (user.avatar.public_id) {
                    await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);

                    const myCloud = await cloudinary.v2.uploader.upload(avatar, {
                        folder: 'doCreate/avatars',
                        width: 150,
                    });

                    user.avatar = {
                        public_id: myCloud.public_id,
                        url: myCloud.secure_url,
                    };
                } else {
                    const myCloud = await cloudinary.v2.uploader.upload(avatar, {
                        folder: 'doCreate/avatars',
                        width: 150,
                    });

                    user.avatar = {
                        public_id: myCloud.public_id,
                        url: myCloud.secure_url,
                    };
                }
            }

            await user?.save();
            await redis.set(userId, JSON.stringify(user));

            res.status(200).json({
                success: true,
                user,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// FORGOT PASSWORD
export const forgotPassword = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email } = req.body as IResetPasswordRequest;

            const user = await UserModel.findOne({ email });

            if (!user) {
                return next(new ErrorHandler('User not found', 404));
            }

            const resetPasswordToken = jwt.sign(
                { _id: user._id },
                process.env.RESET_PASSWORD_TOKEN_SECRET as Secret,
                {
                    expiresIn: '15m',
                },
            );
            const resetPasswordUrl = `
            ${req.protocol}://${req.get('host')}/password/reset/${resetPasswordToken}
            `;
            const data = { user: { name: user.name }, resetPasswordUrl };
            await ejs.renderFile(path.join(__dirname, '../mails/reset-mail.ejs'), data);

            try {
                await sendMail({
                    email,
                    subject: 'Reset Password',
                    template: 'reset-mail.ejs',
                    data,
                });

                res.status(200).json({
                    success: true,
                    message: 'Reset password link sent to your email',
                });
            } catch (error: any) {
                return next(new ErrorHandler(error.message, 400));
            }
            res.status(200).json({
                success: true,
                message: 'Password reset link sent to your email',
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// RESET PASSWORD
export const resetPassword = CatchAsyncErrors(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { resetToken, newPassword } = req.body as IResetPassword;

            const decoded = jwt.verify(
                resetToken,
                process.env.RESET_PASSWORD_TOKEN_SECRET as Secret,
            ) as JwtPayload;

            if (!decoded) {
                return next(new ErrorHandler('Invalid or expired reset token', 400));
            }

            const user = await UserModel.findById(decoded._id);

            if (!user) {
                return next(new ErrorHandler('User not found', 404));
            }
            user.password = newPassword;
            await user.save();
            await redis.set(user?._id, JSON.stringify(user));

            res.status(200).json({
                success: true,
                message: 'Password reset successfully',
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    },
);

// ? TODO: Send mail to confirm email change

// CREATE ACTIVATION TOKEN
export const createActivationToken = (user: any): IActivationToken => {
    const activationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const token = jwt.sign(
        { user, activationCode },
        process.env.ACTIVATION_TOKEN_SECRET as Secret,
        {
            expiresIn: '30m',
        },
    );
    return { token, activationCode };
};
