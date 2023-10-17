import mongoose, { Document, Model, Schema } from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
require('dotenv').config();

const emailRegexPattern: RegExp = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    isVerified: boolean;
    teams: Array<Schema.Types.ObjectId>;
    avatar: {
        public_id: string;
        url: string;
    };
    signAccessToken: () => string;
    signRefreshToken: () => string;
    comparePassword: (password: string) => Promise<boolean>;
}

const userSchema: Schema<IUser> = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            validate: {
                validator: function (email: string) {
                    return emailRegexPattern.test(email);
                },
                message: (props: any) => `${props.value} is not a valid email address`,
            },
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 characters'],
            select: false,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        teams: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Team',
            },
        ],
        avatar: {
            public_id: String,
            url: String,
        },
    },
    { timestamps: true },
);

// ENCRYPT PASSWORD BEFORE SAVING
userSchema.pre<IUser>('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }

    this.password = await bcrypt.hash(this.password, 10);
});

// SIGN ACCESS TOKEN
userSchema.methods.signAccessToken = function (): string {
    return jwt.sign({ id: this._id }, process.env.ACCESS_TOKEN || '', {
        expiresIn: '5m',
    });
};

// SIGN REFRESH TOKEN
userSchema.methods.signRefreshToken = function (): string {
    return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN || '', {
        expiresIn: '7d',
    });
};

// COMPARE PASSWORD
userSchema.methods.comparePassword = async function (enteredPassword: string): Promise<boolean> {
    const user = await UserModel.findOne({ email: this.email }).select('password');
    if (!user) {
        return false;
    }
    return await bcrypt.compare(enteredPassword, user.password);
};

const UserModel: Model<IUser> = mongoose.model('User', userSchema);

export default UserModel;
