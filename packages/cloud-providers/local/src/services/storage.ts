import * as fs from 'fs';
import * as path from 'path';

import { env } from "@cloudnux/utils";

import { encodeStorageKey, getService, LoggerService, StorageService, StorageWriteOptions, StorageWriteResult } from "@cloudnux/core-cloud-provider";

// Use fs.promises for async file operations
const { mkdir, writeFile, readFile, unlink, access, readdir, stat } = fs.promises;

/** Env var holding the absolute path of the local storage directory */
export const STORAGE_DIR_ENV = "DEV_CLOUD_STORAGE_BUCKET";

/** Suffix of the sidecar file holding a stored object's write options */
export const METADATA_SUFFIX = ".metadata.json";

/**
 * Resolve the local storage directory.
 * There is no fallback: the dev server must set DEV_CLOUD_STORAGE_BUCKET
 * to an absolute path inside the environment folder.
 * @returns Absolute path of the storage directory
 */
export function getLocalStorageDir(): string {
    const dir = env(STORAGE_DIR_ENV);
    if (!dir) {
        throw new Error(`${STORAGE_DIR_ENV} is not set. The dev server must set it to the storage directory inside the environment folder.`);
    }
    if (!path.isAbsolute(dir)) {
        throw new Error(`${STORAGE_DIR_ENV} must be an absolute path, got "${dir}".`);
    }
    return dir;
}

/**
 * Validate a bucket name so it maps to exactly one folder under the storage directory
 * @param bucket Bucket name
 */
function assertValidBucket(bucket: string): void {
    if (!bucket) {
        throw new Error('Bucket name is required');
    }
    if (bucket === '.' || bucket === '..' || /[\\/]/.test(bucket)) {
        throw new Error(`Invalid bucket name: ${bucket}`);
    }
}

/**
 * Create a local storage service that uses the filesystem
 * @returns Local filesystem storage service implementation
 */
export function createLocalStorageService(): StorageService {
    const baseDir = getLocalStorageDir();
    const logger = getService<LoggerService>("logger");
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

        const metadataPath = `${filePath}${METADATA_SUFFIX}`;
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
            assertValidBucket(bucket);

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
         * @returns Promise resolving with the bucket, key and encoded key of the stored file
         */
        async write(filePath: string, data: Buffer | string, bucket: string, options?: StorageWriteOptions): Promise<StorageWriteResult> {
            assertValidBucket(bucket);

            const fullPath = getFullPath(bucket, filePath);

            // Ensure directory exists
            await ensureDirectoryExists(fullPath);

            // Write the file
            await writeFile(fullPath, data);

            // Write metadata if options are provided
            if (options) {
                await writeMetadata(fullPath, options);
            }

            // Key as actually stored: normalized, `/` separated, no `../` or `./`
            const storedKey = path.relative(path.join(baseDir, bucket), fullPath).split(path.sep).join('/');

            return {
                bucket,
                key: storedKey,
                encodedKey: encodeStorageKey(storedKey)
            };
        },

        /**
         * Delete file from local filesystem
         * @param filePath Path to the file to delete
         * @param bucket Bucket (folder) name
         * @returns Promise resolving when delete is complete
         */
        async delete(filePath: string, bucket: string): Promise<void> {
            assertValidBucket(bucket);

            const fullPath = getFullPath(bucket, filePath);
            const metadataPath = `${fullPath}${METADATA_SUFFIX}`;

            try {
                await unlink(fullPath);

                // Try to delete metadata file if it exists
                try {
                    await unlink(metadataPath);
                } catch (error) {
                    // Ignore error if metadata file doesn't exist
                    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                        logger.warn({ error }, 'Error deleting metadata file:');
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

// ---------------------------------------------------------------------------
// Read-only helpers for the dev console - read straight off disk each call,
// since the storage directory is the only store.
// ---------------------------------------------------------------------------

export interface StorageBucketInfo {
    name: string;
}

export interface StorageObjectInfo {
    /** Key as stored, `/` separated, not encoded */
    key: string;
    /** Key encoded per segment, ready to append to a base URL */
    encodedKey: string;
    size: number;
    lastModified: string;
    contentType?: string;
}

/**
 * List the buckets (top-level folders) in the local storage directory
 */
export async function listStorageBuckets(): Promise<StorageBucketInfo[]> {
    const baseDir = getLocalStorageDir();
    try {
        const entries = await readdir(baseDir, { withFileTypes: true });
        return entries
            .filter(e => e.isDirectory())
            .map(e => ({ name: e.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
}

/**
 * Read the content type recorded in an object's metadata sidecar, if any
 * @param fullPath Absolute path of the stored object
 */
export async function readStoredContentType(fullPath: string): Promise<string | undefined> {
    try {
        const raw = await readFile(`${fullPath}${METADATA_SUFFIX}`, 'utf8');
        return JSON.parse(raw).contentType || undefined;
    } catch {
        return undefined;
    }
}

/**
 * List every object in a bucket recursively (S3-style flat keys), skipping metadata sidecars
 * @param bucket Bucket name
 * @returns Objects sorted by key, or undefined if the bucket does not exist
 */
export async function listStorageObjects(bucket: string): Promise<StorageObjectInfo[] | undefined> {
    assertValidBucket(bucket);
    const bucketPath = path.join(getLocalStorageDir(), bucket);
    if (!fs.existsSync(bucketPath)) return undefined;

    const objects: StorageObjectInfo[] = [];

    async function walk(dir: string): Promise<void> {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (entry.isFile() && !entry.name.endsWith(METADATA_SUFFIX)) {
                const info = await stat(fullPath);
                const key = path.relative(bucketPath, fullPath).split(path.sep).join('/');
                objects.push({
                    key,
                    encodedKey: encodeStorageKey(key),
                    size: info.size,
                    lastModified: info.mtime.toISOString(),
                    contentType: await readStoredContentType(fullPath),
                });
            }
        }
    }

    await walk(bucketPath);
    return objects.sort((a, b) => a.key.localeCompare(b.key));
}
