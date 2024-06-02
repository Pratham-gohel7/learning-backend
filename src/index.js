import express from "express"
import dotenv from "dotenv"
import connectDB from "./db/index.js";

const app = express();

dotenv.config({
    path: './env'
})

connectDB()
.then(() => {
    app.on("ERROR", (error) => {
        console.log("Database connected but communication error occured..", error)
        throw error;
    })
    
    app.listen(process.env.PORT || 8080, () => {
        console.log(`Server running on http://localhost:${[process.env.PORT]}`)
    })
})
.catch((error) => {
    console.log("Database connection error!!!")
});

/*
import express from "express"
const app = express()

;( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODBURI}/${DB_NAME}`);
        app.on("ERROR", (error) => {
            console.log("Database connected but communication error occured..", error)
            throw error;
        })

        app.listen(process.env.PORT, () => {
            console.log(`Server running on http://localhost:${[process.env.PORT]}`);
        })
    } catch (error) {
        console.log("Error on  connecting the database.....", error)
        throw error;
    }
}) ()

*/