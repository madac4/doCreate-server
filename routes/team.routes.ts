import express from 'express';

import { isAuthenticated } from '../middleware/auth';
import { createTeam, deleteTeam, editTeam, getMembers } from '../controllers/team.controller';
import { isTeamAdmin, isTeamMember } from '../middleware/team';
const teamRouter = express.Router();

teamRouter.post('/create-team', isAuthenticated, createTeam);
teamRouter.put('/edit-team/:id', isAuthenticated, isTeamAdmin, editTeam);
teamRouter.delete('/delete-team/:id', isAuthenticated, isTeamAdmin, deleteTeam);
teamRouter.get('/getMembers/:id', isAuthenticated, isTeamMember, getMembers);

export default teamRouter;
