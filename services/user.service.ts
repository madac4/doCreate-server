import { Response } from 'express';
import { redis } from '../utils/redis';

export const getUserById = async (id: string, res: Response) => {
    const userJSON = await redis.get(id);
    if (userJSON) {
        const user = JSON.parse(userJSON);
        return res.status(200).json({
            success: true,
            user,
        });
    }
};
