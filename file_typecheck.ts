import { createCipher, createDecipher } from "crypto";
import { Client } from "pg";
import { aws_config } from "./aws_config";

// AWS Config
import AWS = require("aws-sdk");
AWS.config.update(aws_config);
var s3: AWS.S3 = new AWS.S3({ apiVersion: "2012-08-10" });

declare global {
    namespace Express {
        interface Request {
            client?: Client;
        }
    }
}

// JPG -> Starts with [FF, D8] and Ends with [FF, D9] (All in hex, converted to decimal in function)
export function is_jpg(fl: Buffer) {
    // Check the file with respective magic numbers.
    const jpg_front = [255, 216];
    const jpg_back = [255, 217];

    const file_front = [fl[0], fl[1]];
    const file_back = [fl[fl.length - 2], fl[fl.length - 1]];

    return (
        JSON.stringify(jpg_front) === JSON.stringify(file_front) &&
        JSON.stringify(jpg_back) === JSON.stringify(file_back)
    );
}

// PDF -> Should start with [25, 50, 44, 46] (in hex)
export function is_pdf(fl: Buffer) {
    // Check the file with respective magic numbers.
    const pdf_check = [37, 80, 68, 70];

    const file_check = [fl[0], fl[1], fl[2], fl[3]];

    return JSON.stringify(pdf_check) === JSON.stringify(file_check);
}

let algorithm = "aes-256-cbc",
    pass = "d6F3Efeq";

// Function to decrypt a buffer.
export const decrypt_buffer = (buffer: any) => {
    try {
        const decipher = createDecipher(algorithm, pass);
        const decrypted = Buffer.concat([
            decipher.update(buffer),
            decipher.final()
        ]);
        return decrypted;
    } catch (err) {
        console.log(err);
    }
};

// Function to decrypt a buffer.
export const encrypt_buffer = (buffer: any) => {
    try {
        const cipher = createCipher(algorithm, pass);
        const encrypted = Buffer.concat([
            cipher.update(buffer),
            cipher.final()
        ]);
        return encrypted;
    } catch (err) {
        console.log(err);
    }
};

// Function to connect to a local postgresql database.
// Creates a client and returns it.
export async function connectdb() {
    try {
        const client: Client = new Client({
            user: "manosriram",
            database: "filedb",
            password: "manosriram",
            port: 5432
        });
        await client.connect();
        return client;
    } catch (err) {
        console.log(err);
    }
}

// Upload a file to s3
export async function upload_file_s3(name: string, data: Buffer, cb: any) {
    const params = {
        Bucket: process.env.BUCKET!,
        ACL: process.env.ACL!,
        Body: data!,
        Key: name!
    };

    s3.putObject(params, async (err: any, data: any) => {
        console.log(data);
        return cb(err, data);
    });
}

// Get the file from s3.
export async function get_file_from_s3(url: string) {
    try {
        const params = {
            Bucket: process.env.BUCKET!,
            Key: url!
        };
        const data = await s3.getObject(params).promise();
        return decrypt_buffer(data.Body!);
    } catch (er) {
        console.log(er);
    }
}
