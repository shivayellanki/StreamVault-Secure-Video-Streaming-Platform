import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

export const uploadFileToS3 = async (filePath, s3Key, contentType) => {
    const fileStream = fs.createReadStream(filePath);
    const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileStream,
        ContentType: contentType,
    };

    try {
        const data = await s3Client.send(new PutObjectCommand(uploadParams));
        return data;
    } catch (err) {
        console.error(`Error uploading ${s3Key} to S3:`, err);
        throw err;
    }
};

export const getFileFromS3 = async (s3Key) => {
    const downloadParams = {
        Bucket: BUCKET_NAME,
        Key: s3Key,
    };

    try {
        const data = await s3Client.send(new GetObjectCommand(downloadParams));
        return data.Body; // This is a readable stream
    } catch (err) {
        console.error(`Error downloading ${s3Key} from S3:`, err);
        throw err;
    }
};

export const getS3Url = (s3Key) => {
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
};
