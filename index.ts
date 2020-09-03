import express, { Request, Response, NextFunction } from "express";
import { file_router } from "./file_router";
import { connectdb } from "./file_typecheck";
import fileUpload from "express-fileupload";

// For ENV Variables.
import * as dotenv from 'dotenv';
dotenv.config();

const app = express();

// A client property in Request to make it accessible in every route.
app.use(async (req: Request, res: Response, next: NextFunction) => {
    req.client = await connectdb();
    next();
});

// Middleware
app.use(fileUpload());
app.use(express.json());

const PORT = 8000;
app.use("/file", file_router);

app.listen(PORT, () => console.log("Server at 8000"));
export { app };
