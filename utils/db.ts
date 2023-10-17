import mongoose from 'mongoose'
require('dotenv').config();

const dbURL: string = process.env.MONGO_URL || '';

export const connectDB = async () => {
    try {
        await mongoose.connect(dbURL).then((data: any) => {
            console.log(`MongoDB connected: ${data.connection.host}`);
        });
    } catch (error: any) {
        console.log(error.message);
        setTimeout(connectDB, 5000);
    }
}