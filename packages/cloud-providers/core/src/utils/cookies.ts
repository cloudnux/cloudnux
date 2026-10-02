import { CookieOptions } from "../services/functions";

/**
 * Serializes a single cookie into a `Set-Cookie` header value.
 * Throws if `sameSite` is "None" without `secure` set, since browsers reject that combination.
 */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
    const {
        path = "/",
        domain,
        maxAge,
        expires,
        httpOnly = true,
        secure = true,
        sameSite = "Lax",
    } = options;

    if (sameSite === "None" && !secure) {
        throw new Error(`Cookie "${name}" sets SameSite=None but not Secure; browsers require Secure with SameSite=None`);
    }

    const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
    parts.push(`Path=${path}`);
    if (domain) parts.push(`Domain=${domain}`);
    if (maxAge !== undefined) parts.push(`Max-Age=${Math.trunc(maxAge)}`);
    if (expires) parts.push(`Expires=${expires.toUTCString()}`);
    if (httpOnly) parts.push("HttpOnly");
    if (secure) parts.push("Secure");
    parts.push(`SameSite=${sameSite}`);

    return parts.join("; ");
}

/**
 * Parses a raw `Cookie` request header (e.g. "a=1; b=2") into a name/value map.
 */
export function parseCookieHeader(header?: string | null): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!header) return cookies;

    for (const pair of header.split(";")) {
        const idx = pair.indexOf("=");
        if (idx === -1) continue;

        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (!name) continue;

        try {
            cookies[name] = decodeURIComponent(value);
        } catch {
            cookies[name] = value;
        }
    }

    return cookies;
}
