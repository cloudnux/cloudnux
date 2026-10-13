import { IService } from "../cloud-container";

export interface StorageService extends IService {
    /**
     * Read data from storage
     * @param path Path to the file/object
     * @param bucket Bucket or container name
     * @returns Promise containing the file data
     */
    read(path: string, bucket: string): Promise<Buffer>;

    /**
     * Write data to storage
     * @param path Path where to store the file/object
     * @param data Data to write
     * @param bucket Bucket or container name
     * @param options Optional configuration for the write operation
     * @returns Promise resolving with the bucket, key and encoded key of the stored file
     */
    write(path: string, data: Buffer | string, bucket: string, options?: StorageWriteOptions): Promise<StorageWriteResult>;

    /**
     * Delete data from storage
     * @param path Path to the file/object to delete
     * @param bucket Bucket or container name
     * @returns Promise resolving when delete is complete
     */
    delete(path: string, bucket: string): Promise<void>;

    /**
     * Check whether an object exists in a bucket
     * @param path Path to the file/object
     * @param bucket Bucket or container name
     * @returns Promise resolving to true if the key exists, false otherwise
     */
    exists(path: string, bucket: string): Promise<boolean>;
}

export interface StorageWriteOptions {
    /** Content type of the file */
    contentType?: string;
    /** Access control for the file (public, private, etc.) */
    acl?: 'private' | 'public-read' | 'public-read-write';
    /** Custom metadata to attach to the file */
    metadata?: Record<string, string>;
}

export interface StorageWriteResult {
    /**
     * Storage bucket or container name
     */
    bucket: string;

    /**
     * Storage key of the written object as stored, not encoded
     * (e.g. `my folder/a #1.png`). Pass it back to read() / delete().
     */
    key: string;

    /**
     * The key URL-encoded per path segment, `/` separators kept
     * (e.g. `my%20folder/a%20%231.png`).
     *
     * cloudnux does not build URLs: the client prepends its own base URL
     * for the bucket, e.g. a CloudFront domain in the cloud or
     * `http://localhost:<port>/__storage/<bucket>` with the local provider.
     */
    encodedKey: string;
}

/**
 * URL-encode a storage key segment by segment, keeping `/` separators.
 */
export function encodeStorageKey(key: string): string {
    return key.split('/').map(encodeURIComponent).join('/');
}
