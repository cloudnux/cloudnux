import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

import {
    encodeStorageKey,
    getService,
    LoggerService,
    StorageService,
    StorageWriteOptions,
    StorageWriteResult,
} from '@cloudnux/core-cloud-provider';
import { env } from '@cloudnux/utils';

// ---------------------------------------------------------------------------
// Addressing
//
//   bucket -> storage account name          e.g. "mediaacct"
//   path   -> "<container>/<blob name>"     e.g. "uploads/2026/a.png"
//
// Account URL comes from AZURE_STORAGE_BLOB_ENDPOINT, a template with an
// {account} placeholder (default https://{account}.blob.core.windows.net).
// Auth is DefaultAzureCredential, except when AZURE_STORAGE_CONNECTION_STRING
// is set and its AccountName matches the bucket (Azurite, CI).
// ---------------------------------------------------------------------------

const DEFAULT_ENDPOINT = 'https://{account}.blob.core.windows.net';

export function resolveAccountUrl(account: string): string {
    return env('AZURE_STORAGE_BLOB_ENDPOINT', DEFAULT_ENDPOINT).replace('{account}', account);
}

export function createBlobServiceClient(account: string): BlobServiceClient {
    const connectionString = env('AZURE_STORAGE_CONNECTION_STRING');
    if (connectionString && /(^|;)AccountName=([^;]+)/i.exec(connectionString)?.[2] === account) {
        return BlobServiceClient.fromConnectionString(connectionString);
    }
    return new BlobServiceClient(resolveAccountUrl(account), new DefaultAzureCredential());
}

export function splitPath(path: string): { container: string; blobName: string } {
    const trimmed = path.replace(/^\/+/, '');
    const slash = trimmed.indexOf('/');
    if (slash <= 0 || slash === trimmed.length - 1) {
        throw new Error(`Invalid storage path "${path}": expected "<container>/<blob name>"`);
    }
    return { container: trimmed.slice(0, slash), blobName: trimmed.slice(slash + 1) };
}

// ---------------------------------------------------------------------------
// Metadata keys
//
// S3 accepts any header-safe key ("x-amz-meta-content-owner"). Azure requires
// metadata names to be valid C# identifiers, so "content-owner" is rejected
// with a 400. Handlers stay provider-agnostic, so the adapter rewrites keys:
// invalid chars -> "_", and a leading digit gets an "_" prefix.
// Azure also lower-cases keys on read; values are untouched.
// ---------------------------------------------------------------------------

export function sanitizeMetadataKey(key: string): string {
    let sanitized = key.replace(/[^A-Za-z0-9_]/g, '_');
    if (sanitized === '' || /^[0-9]/.test(sanitized)) {
        sanitized = `_${sanitized}`;
    }
    return sanitized;
}

export function sanitizeMetadata(metadata?: Record<string, string>): Record<string, string> | undefined {
    if (!metadata) return undefined;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
        result[sanitizeMetadataKey(key)] = value;
    }
    return result;
}

// ---------------------------------------------------------------------------
// ACL
//
// Azure has no per-blob ACL; public read access is a container-level setting
// (and is disabled by default at the account level). `acl` is accepted for
// handler portability and ignored, with a one-time warning when it asks for
// something other than private.
// ---------------------------------------------------------------------------

let aclWarningShown = false;

function warnAclIgnored(acl: string): void {
    if (aclWarningShown) return;
    aclWarningShown = true;
    const message = `StorageWriteOptions.acl="${acl}" is ignored on Azure: blob access is set per container, not per blob.`;
    try {
        getService<LoggerService>('logger').warn({ acl }, message);
    } catch {
        // Logger not registered (e.g. service used standalone): fall back to stderr
        // (console.error is the only console method the repo's lint rules allow).
        console.error(message);
    }
}

/** @internal test hook */
export function resetAclWarning(): void {
    aclWarningShown = false;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

function requireBucket(bucket: string): void {
    if (!bucket) {
        throw new Error('Bucket (storage account name) is required');
    }
}

/**
 * Create Azure Blob Storage service.
 * `bucket` is the storage account, `path` is "<container>/<blob name>".
 */
export function createStorageService(clientFactory: (account: string) => BlobServiceClient = createBlobServiceClient): StorageService {
    // One client per storage account, created on first use.
    const clients = new Map<string, BlobServiceClient>();

    function blob(path: string, bucket: string) {
        requireBucket(bucket);
        const { container, blobName } = splitPath(path);
        let client = clients.get(bucket);
        if (!client) {
            client = clientFactory(bucket);
            clients.set(bucket, client);
        }
        return client.getContainerClient(container).getBlockBlobClient(blobName);
    }

    return {
        async read(path: string, bucket: string): Promise<Buffer> {
            // Missing blobs reject with a RestError (statusCode 404, code BlobNotFound),
            // mirroring the AWS adapter which surfaces S3's NoSuchKey as-is.
            return blob(path, bucket).downloadToBuffer();
        },

        async write(path: string, data: Buffer | string, bucket: string, options?: StorageWriteOptions): Promise<StorageWriteResult> {
            const client = blob(path, bucket);

            if (options?.acl && options.acl !== 'private') {
                warnAclIgnored(options.acl);
            }

            const body = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;

            await client.uploadData(body, {
                blobHTTPHeaders: options?.contentType ? { blobContentType: options.contentType } : undefined,
                metadata: sanitizeMetadata(options?.metadata),
            });

            return {
                bucket,
                key: path,
                encodedKey: encodeStorageKey(path),
            };
        },

        async delete(path: string, bucket: string): Promise<void> {
            // S3 DeleteObject succeeds on a missing key; deleteIfExists keeps that contract.
            // Snapshots must go too, or Azure refuses to delete the base blob.
            await blob(path, bucket).deleteIfExists({ deleteSnapshots: 'include' });
        },

        async exists(path: string, bucket: string): Promise<boolean> {
            return blob(path, bucket).exists();
        },
    };
}
