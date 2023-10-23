import express from 'express';

import { isAuthenticated } from '../middleware/auth';
import {
    createTeam,
    deleteTeam,
    editTeam,
    getMembers,
    inviteMember,
    removeMember,
} from '../controllers/team.controller';
import { isTeamAdmin, isTeamMember } from '../middleware/team';
const teamRouter = express.Router();

teamRouter.post('/create-team', isAuthenticated, createTeam);
teamRouter.post('/invite-member/:id', isAuthenticated, isTeamAdmin, inviteMember);
teamRouter.put('/edit-team/:id', isAuthenticated, isTeamAdmin, editTeam);
teamRouter.put('/remove-member/:id', isAuthenticated, isTeamAdmin, removeMember);
teamRouter.get('/get-members/:id', isAuthenticated, isTeamMember, getMembers);
teamRouter.delete('/delete-team/:id', isAuthenticated, isTeamAdmin, deleteTeam);

export default teamRouter;
