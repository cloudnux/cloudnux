import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

import { encodeStorageKey, StorageService, StorageWriteOptions, StorageWriteResult } from '@cloudnux/core-cloud-provider';
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
        }
    };
}