import * as fs from 'fs';
import * as path from 'path';

import { env, logger } from "@cloudnux/utils";

import { StorageService, StorageWriteOptions, StorageWriteResult } from "@cloudnux/core-cloud-provider";

// Use fs.promises for async file operations
const { mkdir, writeFile, readFile, unlink, access } = fs.promises;

/**
 * Create a local storage service that uses the filesystem
 * @returns Local filesystem storage service implementation
 */
export function createLocalStorageService(): StorageService {
    // Get base directory from environment variables or use default
    const baseDir = env("DEV_CLOUD_STORAGE_BUCKET", path.join(process.cwd(), '.local-storage'))!;

    // Create base directory if it doesn't exist
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }

    /**
     * Ensures the directory for a file exists
     * @param filePath Path to the file
     */
    async function ensureDirectoryExists(filePath: string): Promise<void> {
        const directory = path.dirname(filePath);
        try {
            await access(directory);
        } catch {
            // Directory doesn't exist, create it
            await mkdir(directory, { recursive: true });
        }
    }

    /**
     * Get the full path to a file
     * @param bucket Bucket name (folder)
     * @param filePath Relative path within the storage
     * @returns Absolute file path
     */
    function getFullPath(bucket: string, filePath: string): string {
        // Normalize the path to prevent directory traversal
        const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
        const bucketPath = path.join(baseDir, bucket);

        // Create bucket directory if it doesn't exist
        if (!fs.existsSync(bucketPath)) {
            fs.mkdirSync(bucketPath, { recursive: true });
        }

        return path.join(bucketPath, normalizedPath);
    }

    /**
     * Write metadata for a file
     * @param filePath Path to the file
     * @param options File options
     */
    async function writeMetadata(filePath: string, options?: StorageWriteOptions): Promise<void> {
        if (!options) return;

        const metadataPath = `${filePath}.metadata.json`;
        const metadata = {
            contentType: options.contentType,
            acl: options.acl,
            metadata: options.metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    }

    return {
        /**
         * Read data from local filesystem
         * @param filePath Path to the file
         * @param bucket Bucket (folder) name
         * @returns Promise containing the file data
         */
        async read(filePath: string, bucket: string): Promise<Buffer> {
            if (!bucket) {
                throw new Error('Bucket name is required');
            }

            const fullPath = getFullPath(bucket, filePath);

            try {
                return await readFile(fullPath);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    throw new Error(`File not found: ${filePath} in bucket ${bucket}`);
                }
                throw error;
            }
        },

        /**
         * Write data to local filesystem
         * @param filePath Path where to store the file
         * @param data Data to write
         * @param bucket Bucket (folder) name
         * @param options Optional configuration for the write operation
         * @returns Promise resolving with the result including URL of the stored file
         */
        async write(filePath: string, data: Buffer | string, bucket: string, options?: StorageWriteOptions): Promise<StorageWriteResult> {
            if (!bucket) {
                throw new Error('Bucket name is required');
            }

            const fullPath = getFullPath(bucket, filePath);

            // Ensure directory exists
            await ensureDirectoryExists(fullPath);

            // Write the file
            await writeFile(fullPath, data);

            // Write metadata if options are provided
            if (options) {
                await writeMetadata(fullPath, options);
            }

            // Create URL
            const fileUrl = `file://${fullPath}`;

            return {
                url: fileUrl,
                bucket,
                key: filePath
            };
        },

        /**
         * Delete file from local filesystem
         * @param filePath Path to the file to delete
         * @param bucket Bucket (folder) name
         * @returns Promise resolving when delete is complete
         */
        async delete(filePath: string, bucket: string): Promise<void> {
            if (!bucket) {
                throw new Error('Bucket name is required');
            }

            const fullPath = getFullPath(bucket, filePath);
            const metadataPath = `${fullPath}.metadata.json`;

            try {
                await unlink(fullPath);

                // Try to delete metadata file if it exists
                try {
                    await unlink(metadataPath);
                } catch (error) {
                    // Ignore error if metadata file doesn't exist
                    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                        logger.warn('Error deleting metadata file:', { error });
                    }
                }
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    throw new Error(`File not found: ${filePath} in bucket ${bucket}`);
                }
                throw error;
            }
        }
    };
}