export interface StorageService {
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
     * @returns Promise resolving with the result including URL of the stored file
     */
    write(path: string, data: Buffer | string, bucket: string, options?: StorageWriteOptions): Promise<StorageWriteResult>;

    /**
     * Delete data from storage
     * @param path Path to the file/object to delete
     * @param bucket Bucket or container name
     * @returns Promise resolving when delete is complete
     */
    delete(path: string, bucket: string): Promise<void>;
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
     * URL to access the stored file
     */
    url: string;
    /**
     * Storage bucket or container name
     */
    bucket: string;

    /**
     * Storage key or path
     */
    key: string;
}