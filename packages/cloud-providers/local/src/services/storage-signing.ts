import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Signed URLs of the local storage (the dev server counterpart of S3 presigned URLs).
 *
 * The local storage service signs, the storage plugin verifies; both run in the
 * dev server process and share the key below. The key is random per process
 * unless DEV_CLOUD_STORAGE_SIGNING_KEY is set, so URLs stop working after a
 * dev server restart, like short-lived presigned URLs would.
 */

/** Env var with the public base URL of the storage plugin, e.g. http://localhost:3000/__storage */
export const STORAGE_URL_ENV = "DEV_CLOUD_STORAGE_URL";

/** Optional fixed signing key, e.g. to keep URLs valid across dev server restarts */
export const STORAGE_SIGNING_KEY_ENV = "DEV_CLOUD_STORAGE_SIGNING_KEY";

/** Query parameter names carried by a signed upload URL */
export const SIGNED_PARAMS = {
    expires: "X-Cnx-Expires",
    contentType: "X-Cnx-Content-Type",
    contentLength: "X-Cnx-Content-Length",
    ifNoneMatch: "X-Cnx-If-None-Match",
    signature: "X-Cnx-Signature",
} as const;

let processKey: Buffer | undefined;

function signingKey(): Buffer {
    const configured = process.env[STORAGE_SIGNING_KEY_ENV];
    if (configured) return Buffer.from(configured, "utf8");
    return processKey ??= randomBytes(32);
}

/**
 * Base URL of the storage plugin, without trailing slash
 */
export function getStorageBaseUrl(): string {
    const value = process.env[STORAGE_URL_ENV];
    if (!value) {
        throw new Error(`${STORAGE_URL_ENV} is not set. The dev server sets it to http://localhost:<port>/__storage.`);
    }
    return value.replace(/\/+$/, "");
}

export type UploadSignatureInput = {
    bucket: string;
    key: string;
    /** Unix time in seconds */
    expires: number;
    contentType: string;
    contentLength?: number;
    ifNoneMatch: boolean;
};

function canonical(input: UploadSignatureInput): string {
    return [
        "PUT",
        input.bucket,
        input.key,
        String(input.expires),
        input.contentType,
        input.contentLength === undefined ? "" : String(input.contentLength),
        input.ifNoneMatch ? "*" : "",
    ].join("\n");
}

function hmac(input: UploadSignatureInput): string {
    return createHmac("sha256", signingKey()).update(canonical(input)).digest("hex");
}

/**
 * Build the signed query string for an upload
 */
export function signUpload(input: UploadSignatureInput): URLSearchParams {
    const params = new URLSearchParams();
    params.set(SIGNED_PARAMS.expires, String(input.expires));
    params.set(SIGNED_PARAMS.contentType, input.contentType);
    if (input.contentLength !== undefined) {
        params.set(SIGNED_PARAMS.contentLength, String(input.contentLength));
    }
    if (input.ifNoneMatch) {
        params.set(SIGNED_PARAMS.ifNoneMatch, "*");
    }
    params.set(SIGNED_PARAMS.signature, hmac(input));
    return params;
}

export type UploadRequest = {
    bucket: string;
    key: string;
    query: Record<string, string | undefined>;
    /** Content-Type header of the request */
    contentType?: string;
    /** If-None-Match header of the request */
    ifNoneMatch?: string;
    /** Size of the received body in bytes */
    bodyLength: number;
    /** Current time in ms, for tests */
    now?: number;
};

export type UploadVerification =
    | { ok: true; contentType: string; ifNoneMatch: boolean }
    | { ok: false; status: number; error: string };

/**
 * Verify a PUT against its signed URL: signature, expiry, and that the request
 * carries exactly the signed content type, size and If-None-Match.
 */
export function verifyUpload(request: UploadRequest): UploadVerification {
    const { query } = request;
    const signature = query[SIGNED_PARAMS.signature];
    const expiresRaw = query[SIGNED_PARAMS.expires];
    const contentType = query[SIGNED_PARAMS.contentType];

    if (!signature || !expiresRaw || !contentType) {
        return { ok: false, status: 403, error: "Missing signature: request an upload URL with createUploadUrl()" };
    }

    const expires = Number(expiresRaw);
    const contentLengthRaw = query[SIGNED_PARAMS.contentLength];
    const contentLength = contentLengthRaw === undefined ? undefined : Number(contentLengthRaw);
    const ifNoneMatch = query[SIGNED_PARAMS.ifNoneMatch] === "*";

    const expected = Buffer.from(hmac({ bucket: request.bucket, key: request.key, expires, contentType, contentLength, ifNoneMatch }), "hex");
    const given = Buffer.from(signature, "hex");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
        return { ok: false, status: 403, error: "Signature does not match" };
    }

    if (!Number.isFinite(expires) || (request.now ?? Date.now()) > expires * 1000) {
        return { ok: false, status: 403, error: "Upload URL has expired" };
    }

    const sentType = (request.contentType ?? "").trim().toLowerCase();
    if (sentType !== contentType.trim().toLowerCase()) {
        return { ok: false, status: 403, error: `Content-Type must be "${contentType}"` };
    }

    if (contentLength !== undefined && request.bodyLength !== contentLength) {
        return { ok: false, status: 403, error: `Body must be ${contentLength} bytes, got ${request.bodyLength}` };
    }

    if (ifNoneMatch && (request.ifNoneMatch ?? "").trim() !== "*") {
        return { ok: false, status: 403, error: 'Header "If-None-Match: *" is required' };
    }

    return { ok: true, contentType, ifNoneMatch };
}
