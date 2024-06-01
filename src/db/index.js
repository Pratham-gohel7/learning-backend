import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODBURI}/${DB_NAME}`)
        console.log (`Database connected succesfully at ${connectionInstance.connection.host}`)
    } catch (error) {
        console.log("Error on  connecting the database.....", error)
        process.exit(1)
    }
} 

export default connectDB