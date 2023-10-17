import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ITeam extends Document {
    name: string;
    admin: Schema.Types.ObjectId;
    members: Array<Schema.Types.ObjectId>;
    documents: Array<Schema.Types.ObjectId>;
}

const teamSchema: Schema<ITeam> = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        unique: true,
    },
    admin: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    members: [
        {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
    ],
    documents: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Document',
        },
    ],
});

const TeamModel: Model<ITeam> = mongoose.model<ITeam>('Team', teamSchema);

export default TeamModel;
