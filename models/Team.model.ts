import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ITeam extends Document {
    name: string;
    admin: Schema.Types.ObjectId;
    members: Array<Schema.Types.ObjectId>;
    documents: Array<Schema.Types.ObjectId>;
}

export interface IInvitation extends Document {
    email: string;
    status: 'pending' | 'accepted' | 'declined';
    team: Schema.Types.ObjectId;
}

interface IDocument extends Document {
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
}

const invitationSchema = new Schema<IInvitation>({
    email: {
        type: String,
        required: [true, 'Email is required'],
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined'],
        default: 'pending',
    },
    team: {
        type: Schema.Types.ObjectId,
        required: [true, 'Team is required'],
        ref: 'Team',
    },
});

const documentSchema = new Schema<IDocument>({
    filename: {
        type: String,
        required: [true, 'Filename is required'],
    },
    originalName: {
        type: String,
        required: [true, 'Original name is required'],
    },
    size: {
        type: Number,
        required: [true, 'Size is required'],
    },
    mimetype: {
        type: String,
        required: [true, 'Mimetype is required'],
    },
});

const teamSchema: Schema<ITeam> = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
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
        documents: [documentSchema],
    },
    { timestamps: true },
);

const TeamModel: Model<ITeam> = mongoose.model<ITeam>('Team', teamSchema);
export const InvitationModel: Model<IInvitation> = mongoose.model<IInvitation>(
    'Invitation',
    invitationSchema,
);

export default TeamModel;
