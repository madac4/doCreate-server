import express from 'express';
import {
    activateUser,
    forgotPassword,
    getUserInfo,
    loginUser,
    logoutUser,
    registerUser,
    resetPassword,
    updateAccessToken,
    updatePassword,
    updateProfilePicture,
    updateUserInfo,
} from '../controllers/user.controller';
import { isAuthenticated } from '../middleware/auth';
const userRouter = express.Router();

userRouter.post('/registration', registerUser);
userRouter.post('/activate-user', activateUser);
userRouter.post('/login', loginUser);
userRouter.get('/logout', isAuthenticated, logoutUser);
userRouter.get('/refresh', updateAccessToken);
userRouter.get('/me', isAuthenticated, getUserInfo);
userRouter.put('/update-user', isAuthenticated, updateUserInfo);
userRouter.put('/update-password', isAuthenticated, updatePassword);
userRouter.put('/update-avatar', isAuthenticated, updateProfilePicture);
userRouter.put('/reset-password', resetPassword);
userRouter.post('/forgot-password', forgotPassword);

export default userRouter;
