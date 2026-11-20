import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

import {
    encodeStorageKey,
    SignedDownloadOptions,
    SignedUploadOptions,
    SignedUrl,
    StorageObjectCreated,
    StorageService,
    StorageWriteOptions,
    StorageWriteResult,
} from '@cloudnux/core-cloud-provider';

/** Default lifetime of signed URLs, in seconds */
const DEFAULT_EXPIRES_IN = 300;

/**
 * S3 event keys are URL-encoded with "+" for spaces
 */
function decodeS3Key(key: string): string {
    return decodeURIComponent(key.replace(/\+/g, ' '));
}

/**
 * Read an S3 "object created" event in any of the shapes it reaches a queue:
 * - S3 event notification ({ Records: [{ eventSource: "aws:s3", s3: {...} }] })
 * - the same inside an SNS envelope ({ Type: "Notification", Message: "<json>" })
 * - EventBridge ({ source: "aws.s3", "detail-type": "Object Created", detail: {...} })
 * Returns null for anything else, including the s3:TestEvent sent when a
 * notification is configured.
 */
export function parseS3ObjectCreated(message: unknown): StorageObjectCreated | null {
    let body: any = message;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            return null;
        }
    }
    if (!body || typeof body !== 'object') return null;

    // SNS envelope (S3 -> SNS -> SQS without raw message delivery)
    if (body.Type === 'Notification' && typeof body.Message === 'string') {
        return parseS3ObjectCreated(body.Message);
    }

    // EventBridge
    if (body.source === 'aws.s3' && body['detail-type'] === 'Object Created' && body.detail) {
        const detail = body.detail;
        if (!detail.bucket?.name || !detail.object?.key) return null;
        return {
            bucket: detail.bucket.name,
            key: detail.object.key,
            size: detail.object.size,
            eTag: detail.object.etag,
        };
    }

    // S3 event notification
    if (Array.isArray(body.Records)) {
        const record = body.Records.find((r: any) =>
            r?.eventSource === 'aws:s3' && typeof r.eventName === 'string' && r.eventName.startsWith('ObjectCreated:'));
        if (!record?.s3?.bucket?.name || !record.s3.object?.key) return null;
        return {
            bucket: record.s3.bucket.name,
            key: decodeS3Key(record.s3.object.key),
            size: record.s3.object.size,
            eTag: record.s3.object.eTag,
        };
    }

    return null;
}
/**
 * Convert a readable stream to a buffer
 * @param stream Readable stream
 * @returns Promise resolving to a buffer
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

/**
 * Create AWS S3 storage service
 * @returns AWS S3 storage service implementation
 */
export function createStorageService(): StorageService {

    // Create S3 client
    const s3Client = new S3Client();

    // Separate client for presigning: by default the SDK adds a checksum of the
    // (empty) request body to PutObject, which would make every presigned
    // upload fail. Only add checksums when the operation requires them.
    let presignClient: S3Client | undefined;
    const getPresignClient = () => presignClient ??= new S3Client({
        requestChecksumCalculation: 'WHEN_REQUIRED',
    });

    return {
        /**
         * Read data from S3
         * @param bucket S3 bucket name
         * @param path Path to the object in the bucket
         * @returns Promise containing the file data
         */
        async read(path: string, bucket: string): Promise<Buffer> {
            if (!bucket) {
                throw new Error('Bucket name is required');
            }

            const command = new GetObjectCommand({
                Bucket: bucket,
                Key: path,
            });

            const response = await s3Client.send(command);

            if (!response.Body) {
                throw new Error(`Object not found: ${path}`);
            }

            return streamToBuffer(response.Body as Readable);
        },

        /**
         * Write data to S3
         * @param path Path where to store the object in the bucket
         * @param data Data to write
         * @param bucket S3 bucket name
         * @param options Optional configuration for the write operation
         * @returns Promise resolving with the bucket, key and encoded key
         */
        async write(path: string, data: Buffer | string, bucket: string, options?: StorageWriteOptions): Promise<StorageWriteResult> {
            if (!bucket) {
                throw new Error('Bucket name is required');
            }

            const command = new PutObjectCommand({
                Bucket: bucket,
                Key: path,
                Body: data,
                ContentType: options?.contentType,
                ACL: options?.acl,
                Metadata: options?.metadata,
            });

            await s3Client.send(command);

            return {
                bucket,
                key: path,
                encodedKey: encodeStorageKey(path)
            };
        },

        /**
         * Delete object from S3
         * @param path Path to the object in the bucket to delete
         * @param bucket S3 bucket name
         * @returns Promise resolving when delete is complete
         */
        async delete(path: string, bucket: string): Promise<void> {
            if (!bucket) {
                throw new Error('Bucket name is required');
            }

            const command = new DeleteObjectCommand({
                Bucket: bucket,
                Key: path,
            });

            await s3Client.send(command);
        },

        /**
         * Check whether an object exists in S3
         * @param path Path to the object in the bucket
         * @param bucket S3 bucket name
         * @returns Promise resolving to true if the key exists, false otherwise
         */
        async exists(path: string, bucket: string): Promise<boolean> {
            if (!bucket) {
                throw new Error('Bucket name is required');
            }

            try {
                await s3Client.send(new HeadObjectCommand({
                    Bucket: bucket,
                    Key: path,
                }));
                return true;
            } catch (error) {
                const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
                if (err.name === 'NotFound' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
                    return false;
                }
                throw error;
            }
        },

        /**
         * Create a presigned S3 PUT URL. Content type, size and (unless overwrite
         * is allowed) If-None-Match: * are signed, so S3 rejects any other upload.
         */
        async createUploadUrl(path: string, bucket: string, options: SignedUploadOptions): Promise<SignedUrl> {
            if (!bucket) {
                throw new Error('Bucket name is required');
            }
            if (!options?.contentType) {
                throw new Error('contentType is required for an upload URL');
            }

            const expiresIn = options.expiresIn ?? DEFAULT_EXPIRES_IN;
            const overwrite = options.overwrite ?? false;

            const command = new PutObjectCommand({
                Bucket: bucket,
                Key: path,
                ContentType: options.contentType,
                ContentLength: options.contentLength,
                IfNoneMatch: overwrite ? undefined : '*',
            });

            const signableHeaders = new Set(['content-type']);
            if (options.contentLength !== undefined) signableHeaders.add('content-length');
            if (!overwrite) signableHeaders.add('if-none-match');

            const url = await getSignedUrl(getPresignClient(), command, { expiresIn, signableHeaders });

            const headers: Record<string, string> = { 'content-type': options.contentType };
            if (!overwrite) headers['if-none-match'] = '*';

            return {
                url,
                method: 'PUT',
                headers,
                expiresAt: new Date(Date.now() + expiresIn * 1000),
                bucket,
                key: path,
            };
        },

        /**
         * Create a presigned S3 GET URL (range requests supported by S3)
         */
        async createDownloadUrl(path: string, bucket: string, options?: SignedDownloadOptions): Promise<SignedUrl> {
            if (!bucket) {
                throw new Error('Bucket name is required');
            }

            const expiresIn = options?.expiresIn ?? DEFAULT_EXPIRES_IN;
            const command = new GetObjectCommand({
                Bucket: bucket,
                Key: path,
                ResponseContentDisposition: options?.contentDisposition,
            });

            const url = await getSignedUrl(getPresignClient(), command, { expiresIn });

            return {
                url,
                method: 'GET',
                headers: {},
                expiresAt: new Date(Date.now() + expiresIn * 1000),
                bucket,
                key: path,
            };
        },

        parseObjectCreated(message: unknown): StorageObjectCreated | null {
            return parseS3ObjectCreated(message);
        }
    };
}