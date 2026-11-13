import { randomUUID } from 'node:crypto';
import { EmailClient, type EmailAddress as AcsAddress, type EmailMessage as AcsMessage } from '@azure/communication-email';
import { DefaultAzureCredential } from '@azure/identity';

import { EmailMessage, EmailService } from '@cloudnux/core-cloud-provider';
import { env } from '@cloudnux/utils';

/**
 * Email through Azure Communication Services (ACS).
 *
 * The ACS resource that sends a message:
 *   message.configurationSet    "<resource>" or "<resource>.<data location>"
 *   otherwise                   AZURE_COMMUNICATION_RESOURCE, same format
 * Without a data location, AZURE_COMMUNICATION_DATA_LOCATION is used (default "europe"):
 *   "marketing"               → https://marketing.europe.communication.azure.com
 *   "marketing.unitedstates"  → https://marketing.unitedstates.communication.azure.com
 *
 * Auth: AZURE_COMMUNICATION_CONNECTION_STRING if it is for that resource,
 * otherwise DefaultAzureCredential.
 *
 * send() returns once ACS has accepted the message, like SES. Problems that
 * happen later (bounces, blocked recipients) arrive as Event Grid events.
 */
export function createEmailService(): EmailService {
    // One client per ACS resource, created on first use.
    const clients = new Map<string, EmailClient>();

    function clientFor(endpoint: string): EmailClient {
        let client = clients.get(endpoint);
        if (!client) {
            client = connect(endpoint);
            clients.set(endpoint, client);
        }
        return client;
    }

    return {
        async send(message) {
            assertValidMessage(message);
            const endpoint = endpointFor(message.configurationSet);

            // We choose the operation id, and it becomes the message id.
            const messageId = randomUUID();
            try {
                const poller = await clientFor(endpoint).beginSend(toAcsMessage(message), { operationId: messageId });

                const { status, error } = poller.getOperationState();
                if (status === 'failed' || status === 'canceled') {
                    return { status: 'failed', error: error?.message ?? `ACS reported the send as ${status}` };
                }
                return { status: 'sent', messageId };
            } catch (error) {
                return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
            }
        },
    };
}

// ---------------------------------------------------------------------------
// ACS resource and connection
// ---------------------------------------------------------------------------

function endpointFor(configurationSet?: string): string {
    const resource = configurationSet || env('AZURE_COMMUNICATION_RESOURCE');
    if (!resource) {
        throw new Error('No ACS resource to send from: set message.configurationSet or AZURE_COMMUNICATION_RESOURCE.');
    }
    const host = resource.includes('.')
        ? resource
        : `${resource}.${env('AZURE_COMMUNICATION_DATA_LOCATION', 'europe')}`;
    return `https://${host}.communication.azure.com`.toLowerCase();
}

function connect(endpoint: string): EmailClient {
    const connectionString = env('AZURE_COMMUNICATION_CONNECTION_STRING');
    const connectionStringEndpoint = connectionString && /endpoint=(https:\/\/[^/;]+)/i.exec(connectionString)?.[1];
    if (connectionStringEndpoint && connectionStringEndpoint.toLowerCase() === endpoint) {
        return new EmailClient(connectionString);
    }
    return new EmailClient(endpoint, new DefaultAzureCredential());
}

// ---------------------------------------------------------------------------
// Message mapping
// ---------------------------------------------------------------------------

function assertValidMessage(message: EmailMessage): void {
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
        throw new Error('At least one recipient (to) is required');
    }
    if (!message.from) {
        throw new Error('Sender (from) is required');
    }
    if (!message.subject) {
        throw new Error('Subject is required');
    }
    if (!message.html && !message.text) {
        throw new Error('At least one of html or text is required');
    }
}

function toAcsMessage(message: EmailMessage): AcsMessage {
    return {
        // ACS takes the sender's display name from the domain settings, so only the address is used.
        senderAddress: parseAddress(message.from).address,
        // ACS types require html or plainText; assertValidMessage guarantees one of them.
        content: message.html
            ? { subject: message.subject, html: message.html, plainText: message.text }
            : { subject: message.subject, plainText: message.text ?? '' },
        recipients: {
            to: toAddresses(message.to),
            cc: toAddresses(message.cc),
            bcc: toAddresses(message.bcc),
        },
        replyTo: message.replyTo ? [parseAddress(message.replyTo)] : undefined,
        attachments: message.attachments?.map(attachment => ({
            name: attachment.filename,
            contentType: attachment.contentType,
            contentInBase64: Buffer.isBuffer(attachment.content)
                ? attachment.content.toString('base64')
                : attachment.content, // a string is already base64 (see EmailAttachment)
        })),
        // metadata is the provider passthrough; on ACS it becomes custom headers.
        headers: message.metadata,
    };
}

function toAddresses(value?: string | string[]): AcsAddress[] | undefined {
    if (!value) return undefined;
    return (Array.isArray(value) ? value : [value]).map(parseAddress);
}

/** Accepts "mina@example.com" and "Mina <mina@example.com>", as SES does. */
function parseAddress(value: string): AcsAddress {
    const match = /^(.*)<([^>]+)>\s*$/.exec(value);
    if (!match) {
        return { address: value.trim() };
    }
    const displayName = match[1].trim().replace(/^"(.*)"$/, '$1');
    return displayName
        ? { address: match[2].trim(), displayName }
        : { address: match[2].trim() };
}
