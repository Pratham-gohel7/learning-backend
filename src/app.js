import express, { urlencoded } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
const app = express()

app.use(cors({  //Used to allow requests from unknown urls
    origin: process.env.CORS_ORIGIN,
    Credential: true
}))

app.use(express.json({limit: "12kb"}))  // Used to set limit on recieving json files.
app.use(urlencoded({extended: true, limit: "12kb"})) // Used to encode a url
app.use(express.static("public")) // Used to store the files and folder in own server.
app.use(cookieParser())

//importing route
import userRouter from "./routes/user.route.js";

//Router declaration : here we need to use middleware so we use "use" method.
app.use("users", userRouter)

export default { app }