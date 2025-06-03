import * as crypto from 'crypto';

// Custom JWT implementation without dependencies
interface JWTOptions {
    audience?: string | string[];
    expiresIn?: string | number;
    notBefore?: string | number;
    jwtid?: string;
    issuer?: string;
    ignoreExpiration?: boolean;
}

interface JWTPayload {
    aud?: string | string[];
    exp?: number;
    nbf?: number;
    jti?: string;
    iss?: string;
    iat: number;
    [key: string]: any;
}

/**
 * Parses a time string like "1h" or "100ms" to milliseconds
 */
function parseTimeToMs(time: string | number): number {
    if (typeof time === 'number') return time * 1000; // Assuming number input is in seconds

    const match = time.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    switch (unit) {
        case 'ms': return value;
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return 0;
    }
}

/**
 * Base64Url encode a string or buffer
 */
function base64UrlEncode(input: string | Buffer): string {
    const str = typeof input === 'string' ? input : input.toString('base64');
    return str
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

/**
 * Base64Url decode a string to Buffer
 */
function base64UrlDecode(input: string): Buffer {
    let str = input
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    // Add padding if needed
    while (str.length % 4) {
        str += '=';
    }

    return Buffer.from(str, 'base64');
}

/**
 * Create a JWT
 */
function createAccessToken(
    claims: Record<string, string>,
    privateKey: string,
    expiresIn: string = "1h"
): string {
    const now = Math.floor(Date.now() / 1000);

    // Create header
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

    // Create payload with claims and standard JWT fields
    const payload: JWTPayload = {
        ...claims,
        aud: ["*"],
        iat: now,
        iss: "vcg-identity",
        jti: Date.now().toString()
    };

    // Add expiration
    if (expiresIn) {
        const expiryMs = parseTimeToMs(expiresIn);
        payload.exp = now + Math.floor(expiryMs / 1000);
    }

    // Add not before
    const notBefore = "100ms";
    if (notBefore) {
        const notBeforeMs = parseTimeToMs(notBefore);
        payload.nbf = now + Math.floor(notBeforeMs / 1000);
    }

    // Encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));

    // Create signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto
        .createHmac('sha256', privateKey)
        .update(signatureInput)
        .digest();

    const encodedSignature = base64UrlEncode(signature);

    // Return complete JWT
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Generate a UUID v4 without dependencies
 */
function createRefreshToken(): string {
    const bytes = crypto.randomBytes(16);

    // Set version (4) and variant (RFC4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC4122

    // Convert to hex without dashes
    return bytes.toString('hex');
}

/**
 * Decode a JWT token without verification
 */
function decode(token: string): JWTPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const payload = JSON.parse(
            base64UrlDecode(parts[1]).toString('utf8')
        );

        return payload;
    } catch {
        return null;
    }
}

/**
 * Verify a JWT token without dependencies
 */
function verify(token: string, privateKey: string, options: JWTOptions = {}): Promise<JWTPayload> {
    return new Promise((resolve, reject) => {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                return reject(new Error('Invalid token format'));
            }

            const [encodedHeader, encodedPayload, encodedSignature] = parts;

            // Verify signature
            const signatureInput = `${encodedHeader}.${encodedPayload}`;
            const expectedSignature = crypto
                .createHmac('sha256', privateKey)
                .update(signatureInput)
                .digest();

            const providedSignature = base64UrlDecode(encodedSignature);

            const signatureValid = crypto.timingSafeEqual(
                expectedSignature,
                providedSignature
            );

            if (!signatureValid) {
                return reject(new Error('Invalid signature'));
            }

            // Decode payload
            const payload = JSON.parse(
                base64UrlDecode(encodedPayload).toString('utf8')
            );

            // Verify expiration
            if (!options.ignoreExpiration && payload.exp) {
                const now = Math.floor(Date.now() / 1000);
                if (now >= payload.exp) {
                    return reject(new Error('Token expired'));
                }
            }

            // Verify not before
            if (payload.nbf) {
                const now = Math.floor(Date.now() / 1000);
                if (now < payload.nbf) {
                    return reject(new Error('Token not yet valid'));
                }
            }

            // Verify issuer
            if (options.issuer && payload.iss !== options.issuer) {
                return reject(new Error('Invalid issuer'));
            }

            // Verify audience
            if (options.audience) {
                const audiences = Array.isArray(options.audience) ? options.audience : [options.audience];
                const tokenAudiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

                const validAudience = audiences.some(aud =>
                    tokenAudiences.includes(aud)
                );

                if (!validAudience) {
                    return reject(new Error('Invalid audience'));
                }
            }

            resolve(payload);
        } catch (error) {
            reject(error);
        }
    });
}


export const tokenUtils = {
    createAccessToken,
    createRefreshToken,
    decodeAccessToken: decode,
    verifyAccessToken: verify,
}