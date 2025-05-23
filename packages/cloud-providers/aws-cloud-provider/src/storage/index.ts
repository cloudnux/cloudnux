import { Readable } from "stream";

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

type Content = Readable | Buffer;
type Options = {
    streamEnabled: boolean,
}

let _client = new S3Client();
const ensureClient = () => {
    if (!_client) {
        _client = new S3Client();
    }
    return _client;
}


export async function remove(source: string, url: string) {
    const client = ensureClient();
    const result = await client.send(
        new DeleteObjectCommand({
            Bucket: source,
            Key: url
        })
    );
    return result.DeleteMarker;
}

export async function write(source: string, url: string, body: Content) {
    const client = ensureClient();
    return await client.send(
        new PutObjectCommand({
            Bucket: source,
            Key: url,
            Body: body
        })
    ).then(r => {
        return { url: `https://${source}.s3.${client.config.region}.amazonaws.com/${url}` }
    })
}

export async function read(source: string, url: string, options: Options = {
    streamEnabled: false
}) {
    const client = ensureClient();
    const result = await client.send(
        new GetObjectCommand({
            Bucket: source,
            Key: url
        }));

    if (options.streamEnabled) {
        return result.Body as Readable;
    }
    return Buffer.from(await result.Body.transformToByteArray());
}