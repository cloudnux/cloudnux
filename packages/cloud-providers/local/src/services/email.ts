import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

import { env } from "@cloudnux/utils";

import { EmailAttachment, EmailMessage, EmailSendResult, EmailService, getService, LoggerService } from "@cloudnux/core-cloud-provider";

const { mkdir, writeFile, readdir, readFile, unlink } = fs.promises;

const MAX_HISTORY = 100;
const PREVIEW_LENGTH = 150;

export type EmailHistoryEntry = {
    id: string;
    messageId: string;
    timestamp: string;
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    preview: string;
    hasAttachments: boolean;
    attachmentCount?: number;
    configurationSet?: string;
    status: "sent" | "failed";
    error?: string;
};

function resolveBaseDir(): string {
    return env("DEV_CLOUD_EMAIL_DIR", path.join(process.cwd(), '.local-email'))!;
}

function toArray(value?: string | string[]): string[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function assertValidMessage(message: EmailMessage): void {
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
        throw new Error("At least one recipient (to) is required");
    }
    if (!message.from) {
        throw new Error("Sender (from) is required");
    }
    if (!message.subject) {
        throw new Error("Subject is required");
    }
    if (!message.html && !message.text) {
        throw new Error("At least one of html or text is required");
    }
}

function slugify(subject: string): string {
    const slug = subject
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return (slug || 'email').slice(0, 50);
}

// Rough, regex-based tag strip - good enough for an inbox-style preview
// snippet, not meant to be a general HTML sanitizer.
function stripHtml(html: string): string {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');
}

function buildPreview(message: EmailMessage): string {
    const source = message.text ?? stripHtml(message.html ?? '');
    const collapsed = source.replace(/\s+/g, ' ').trim();
    return collapsed.length > PREVIEW_LENGTH
        ? collapsed.slice(0, PREVIEW_LENGTH).trimEnd() + '…'
        : collapsed;
}

function encodeHeaderValue(value: string): string {
    return /^[\x00-\x7F]*$/.test(value)
        ? value
        : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function randomBoundary(): string {
    return `----=_Part_${randomUUID().replace(/-/g, '')}`;
}

function base64Wrap(data: Buffer): string {
    return data.toString('base64').replace(/(.{76})/g, '$1\r\n');
}

function textPart(contentType: string, data: string): string {
    return [
        `Content-Type: ${contentType}; charset=UTF-8`,
        'Content-Transfer-Encoding: base64',
        '',
        base64Wrap(Buffer.from(data, 'utf8')),
    ].join('\r\n');
}

function attachmentContent(attachment: EmailAttachment): Buffer {
    return Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(attachment.content, 'base64');
}

function attachmentPart(attachment: EmailAttachment): string {
    return [
        `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        'Content-Transfer-Encoding: base64',
        '',
        base64Wrap(attachmentContent(attachment)),
    ].join('\r\n');
}

function multipart(boundary: string, type: string, parts: string[]): string {
    const body = parts.map((part) => `--${boundary}\r\n${part}`).join('\r\n');
    return `Content-Type: multipart/${type}; boundary="${boundary}"\r\n\r\n${body}\r\n--${boundary}--`;
}

function buildEml(message: EmailMessage, messageId: string): string {
    const headers: string[] = [
        `From: ${message.from}`,
        `To: ${toArray(message.to).join(', ')}`,
    ];

    const cc = toArray(message.cc);
    if (cc.length) headers.push(`Cc: ${cc.join(', ')}`);

    const bcc = toArray(message.bcc);
    if (bcc.length) headers.push(`Bcc: ${bcc.join(', ')}`);

    if (message.replyTo) headers.push(`Reply-To: ${message.replyTo}`);

    headers.push(`Subject: ${encodeHeaderValue(message.subject)}`);
    headers.push(`Date: ${new Date().toUTCString()}`);
    headers.push(`Message-ID: <${messageId}@local-cloud-provider>`);
    headers.push('MIME-Version: 1.0');

    const bodyParts: string[] = [];
    if (message.text) bodyParts.push(textPart('text/plain', message.text));
    if (message.html) bodyParts.push(textPart('text/html', message.html));

    const bodyContent = bodyParts.length > 1
        ? multipart(randomBoundary(), 'alternative', bodyParts)
        : bodyParts[0];

    if (!message.attachments?.length) {
        return [...headers, bodyContent].join('\r\n');
    }

    const attachmentParts = message.attachments.map(attachmentPart);
    const mixedBody = multipart(randomBoundary(), 'mixed', [bodyContent, ...attachmentParts]);

    return [...headers, mixedBody].join('\r\n');
}

// Newest-first: ids are Date.now()-prefixed, so a reverse lexicographic
// sort is a reverse chronological sort.
async function listEntryIds(baseDir: string): Promise<string[]> {
    if (!fs.existsSync(baseDir)) return [];
    const files = await readdir(baseDir);
    return files
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.slice(0, -'.json'.length))
        .sort()
        .reverse();
}

// Deletes files on disk down to MAX_HISTORY entries - no in-memory list is
// kept, so the directory itself is both the store and the retention log.
async function enforceRetention(baseDir: string, logger: LoggerService): Promise<void> {
    const ids = await listEntryIds(baseDir);
    const overflow = ids.length - MAX_HISTORY;
    if (overflow <= 0) return;

    const toRemove = ids.slice(-overflow);
    await Promise.all(toRemove.map(async (id) => {
        try {
            await unlink(path.join(baseDir, `${id}.eml`));
            await unlink(path.join(baseDir, `${id}.json`));
        } catch (error) {
            logger.warn({ error }, `Failed to prune local email history entry ${id}`);
        }
    }));
}

/**
 * Create a local email service that writes each send as an .eml file plus
 * a metadata sidecar (mirroring storage.ts's *.metadata.json convention).
 * No real network send happens - this is purely for dev-console inspection.
 * @returns Local filesystem-backed email service implementation
 */
export function createLocalEmailService(): EmailService {
    const baseDir = resolveBaseDir();
    const logger = getService<LoggerService>("logger");

    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }

    return {
        async send(message: EmailMessage): Promise<EmailSendResult> {
            assertValidMessage(message);

            const messageId = randomUUID();
            const id = `${Date.now()}-${slugify(message.subject)}-${Math.random().toString(36).slice(2, 7)}`;

            try {
                await mkdir(baseDir, { recursive: true });

                const eml = buildEml(message, messageId);
                await writeFile(path.join(baseDir, `${id}.eml`), eml, 'utf8');

                const metadata: EmailHistoryEntry = {
                    id,
                    messageId,
                    timestamp: new Date().toISOString(),
                    from: message.from,
                    to: toArray(message.to),
                    cc: toArray(message.cc).length ? toArray(message.cc) : undefined,
                    subject: message.subject,
                    preview: buildPreview(message),
                    hasAttachments: !!message.attachments?.length,
                    attachmentCount: message.attachments?.length || undefined,
                    configurationSet: message.configurationSet,
                    status: 'sent',
                };

                await writeFile(path.join(baseDir, `${id}.json`), JSON.stringify(metadata, null, 2), 'utf8');
                await enforceRetention(baseDir, logger);

                return { status: 'sent', messageId };
            } catch (error) {
                logger.error({ error }, 'Failed to write local email');
                return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
            }
        },
    };
}

/**
 * Reads the most recent email history entries straight off disk - no
 * in-memory cache, so this is safe to call from any bundle (e.g.
 * dev-console-plugin) independently of the EmailService instance.
 * @param limit Maximum number of entries to return
 * @returns Metadata for the most recent sends, newest first
 */
export async function listEmailHistory(limit: number = MAX_HISTORY): Promise<EmailHistoryEntry[]> {
    const baseDir = resolveBaseDir();
    const ids = (await listEntryIds(baseDir)).slice(0, limit);

    return Promise.all(ids.map(async (id) => {
        const raw = await readFile(path.join(baseDir, `${id}.json`), 'utf8');
        return JSON.parse(raw) as EmailHistoryEntry;
    }));
}

/**
 * Reads one email's metadata by id.
 * @param id History entry id (the file basename)
 * @returns The entry's metadata, or undefined if not found
 */
export async function getEmailHistoryEntry(id: string): Promise<EmailHistoryEntry | undefined> {
    try {
        const raw = await readFile(path.join(resolveBaseDir(), `${id}.json`), 'utf8');
        return JSON.parse(raw) as EmailHistoryEntry;
    } catch {
        return undefined;
    }
}

/**
 * Reads one email's raw .eml (MIME) content by id.
 * @param id History entry id (the file basename)
 * @returns The raw MIME content, or undefined if not found
 */
export async function getEmailRaw(id: string): Promise<string | undefined> {
    try {
        return await readFile(path.join(resolveBaseDir(), `${id}.eml`), 'utf8');
    } catch {
        return undefined;
    }
}
