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

    /**
     * Create a time-limited URL the client uploads one object to directly,
     * without going through the API (aws: presigned S3 PUT, local: signed
     * dev-server URL). Issue it from an authenticated handler: the URL itself
     * carries the permission, so anyone holding it can use it until it expires.
     * @param path Key of the object to create
     * @param bucket Bucket or container name
     * @param options Content type, size, expiry and overwrite rules baked into the signature
     * @returns The URL plus the headers the client must send with the upload
     */
    createUploadUrl(path: string, bucket: string, options: SignedUploadOptions): Promise<SignedUrl>;

    /**
     * Create a time-limited URL to download one object directly
     * (supports range requests where the store does)
     * @param path Key of the object
     * @param bucket Bucket or container name
     * @param options Expiry and response overrides
     * @returns The URL
     */
    createDownloadUrl(path: string, bucket: string, options?: SignedDownloadOptions): Promise<SignedUrl>;

    /**
     * Read an "object created" notification that arrived through a queue or topic
     * (aws: S3 event notification, also inside an SNS envelope; local: the
     * dev server's storage notification). Pass the parsed message body.
     * @param message Message body, as returned by the event context's message()
     * @returns The created object, or null if the message is not an object-created event (e.g. a test event)
     */
    parseObjectCreated(message: unknown): StorageObjectCreated | null;
}

export interface SignedUploadOptions {
    /** Content type the client must upload with; part of the signature */
    contentType: string;
    /**
     * Exact size in bytes the client will upload; part of the signature when set,
     * so a different size is rejected
     */
    contentLength?: number;
    /** Seconds until the URL expires @default 300 */
    expiresIn?: number;
    /**
     * Allow replacing an existing object. When false, the upload only succeeds
     * if the key does not exist yet (If-None-Match: *) @default false
     */
    overwrite?: boolean;
}

export interface SignedDownloadOptions {
    /** Seconds until the URL expires @default 300 */
    expiresIn?: number;
    /** Content-Disposition of the response, e.g. `attachment; filename="invoice.pdf"` */
    contentDisposition?: string;
}

export interface SignedUrl {
    /** The full URL to call */
    url: string;
    /** HTTP method to use */
    method: 'PUT' | 'GET';
    /**
     * Headers the client must send exactly as given, they are part of the signature.
     * Content-Length is never listed (browsers set it); the body must have the signed size.
     */
    headers: Record<string, string>;
    /** When the URL stops working */
    expiresAt: Date;
    /** Bucket or container name */
    bucket: string;
    /** Object key, not encoded */
    key: string;
}

export interface StorageObjectCreated {
    /** Bucket or container name */
    bucket: string;
    /** Object key, decoded */
    key: string;
    /** Size in bytes, if the event carries it */
    size?: number;
    /** Content type, if the event carries it (S3 events do not) */
    contentType?: string;
    /** ETag of the object, if the event carries it */
    eTag?: string;
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
