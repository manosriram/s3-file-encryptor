import express, { Request, Response, NextFunction } from "express";
const fs = require("fs");
import {
    is_jpg,
    is_pdf,
    encrypt_buffer,
    upload_file_s3,
    get_file_from_s3,
    decrypt_buffer
} from "./file_typecheck";
const { ENC_KEY } = process.env;
const router: express.Router = express.Router();

// file_type interface for strict type-checking in typescript.
interface file_type {
    name: String;
    data: Buffer;
    size: Number;
    encoding: String;
    tempFilePath: String;
    truncated: Boolean;
    mimetype: String;
    md5: String;
}

// Route to upload a file.
// @POST -> /file/upload

/*
    JSON Upload Format.
    {
        username: string,
        file: File
    }
*/

router.post("/upload", async (req: Request, res: Response) => {
    // Grab file and username
    const file = req.files?.file as file_type;
    const { username } = req.body;

    // If there is no username or filesize is greater than 5MB, exit immediately.
    if (!username)
        return res.status(403).json({ message: "username required" });
    if (file.size > 5242880)
        // 5MB in bytes
        return res.status(403).json({ message: "file size exceeded!" });

    // Checking the file type (jpg or pdf) using "Magic Numbers of a file".
    let mimetype = "";
    if (is_jpg(file.data)) mimetype = ".jpg";
    else if (is_pdf(file.data)) mimetype = ".pdf";
    else
        return res
            .status(403)
            .json({ message: "File format must be in jpg/pdf" });

    // Encrypting the file.
    const encrypted_buffer = encrypt_buffer(file.data);
    const client = req.client;

    // Insert into DB
    const qry = await client!.query(
        `INSERT INTO filetable(username, mimetype, file) VALUES($1, $2, $3) RETURNING id`,
        [username, mimetype, encrypted_buffer]
    );

    // Upload to S3
    await upload_file_s3(
        qry.rows[0].id.toString() + mimetype,
        encrypted_buffer!,
        (err: any, data: any) => {
            if (err) throw new Error(err);
        }
    );

    // Send the id as response.
    return res.send({ message: "File uploaded!", id: qry.rows[0].id });
});

// Route to download a file.
// @GET -> /file/download_file/<id>
router.get(
    "/download_file/:id",
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const client = req.client;

        // Query to grab the file.
        const query = "SELECT * FROM filetable WHERE ID = " + id;
        const qry = await client!.query(query);
        const { mimetype } = qry.rows[0];
        const filename = id.toString() + mimetype;
        let s3_buffer = await get_file_from_s3(filename);

        // Writes to local hard-disk with format <id>.<mimetype>
        fs.writeFile(filename, s3_buffer, (err: any) => {
            if (err) console.log(err);

            console.log("Written to Disk");
        });
        res.send("Writted file to disk!");
    }
);

// @GET -> /file/user_files/<user_name>
router.get(
    "/user_files/:username",
    async (req: Request, res: Response, next: NextFunction) => {
        const client = req.client;
        const { username } = req.params;

        // If there is no username or filesize is greater than 5MB, exit immediately.
        if (!username)
            return res.status(403).json({ message: "username required" });

        // Select Query to get user-files.
        const query =
            "SELECT * FROM filetable where username='" + username + "'";
        const qry_result = await client?.query(query);

        return res.status(200).json({ files: qry_result!.rows });
    }
);

export { router as file_router };
