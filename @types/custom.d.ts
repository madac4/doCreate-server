import { Request } from 'express';
import { IUser } from '../models/User.model';
import { ITeam } from '../models/Team.model';

declare global {
    namespace Express {
        interface Request {
            user: IUser;
            team: ITeam;
        }
    }
}
