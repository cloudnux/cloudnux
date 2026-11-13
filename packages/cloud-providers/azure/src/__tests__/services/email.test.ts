import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EmailMessage } from '@cloudnux/core-cloud-provider';

import { createEmailService } from '../../services/email';
import { azureCloudProvider } from '../../index';

// ---------------------------------------------------------------------------
// Fake ACS email SDK. Tests go through the public service only; the fake
// records what the service asked the SDK to do.
// ---------------------------------------------------------------------------

const acs = vi.hoisted(() => {
    const state = {
        clients: [] as Array<{ args: unknown[] }>,
        sends: [] as Array<{ message: Record<string, any>; options: { operationId: string } }>,
        operationState: { status: 'running' } as { status: string; error?: Error },
        sendError: undefined as Error | undefined,
    };

    class EmailClient {
        constructor(...args: unknown[]) {
            state.clients.push({ args });
        }
        async beginSend(message: Record<string, any>, options: { operationId: string }) {
            if (state.sendError) throw state.sendError;
            state.sends.push({ message, options });
            return { getOperationState: () => state.operationState };
        }
    }

    return { state, EmailClient };
});

vi.mock('@azure/communication-email', () => ({ EmailClient: acs.EmailClient }));
vi.mock('@azure/identity', () => ({ DefaultAzureCredential: class DefaultAzureCredential { } }));

const message: EmailMessage = {
    from: 'DoNotReply@example.azurecomm.net',
    to: 'mina@example.com',
    subject: 'Hej',
    text: 'plain',
};

beforeEach(() => {
    acs.state.clients.length = 0;
    acs.state.sends.length = 0;
    acs.state.operationState = { status: 'running' };
    acs.state.sendError = undefined;
    process.env.AZURE_COMMUNICATION_RESOURCE = 'cnx-mail';
    delete process.env.AZURE_COMMUNICATION_DATA_LOCATION;
    delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
});

// ---------------------------------------------------------------------------

describe('send', () => {
    it('maps every field of the message to ACS', async () => {
        await createEmailService().send({
            from: 'Cloudnux <DoNotReply@example.azurecomm.net>',
            to: ['Mina <mina@example.com>', 'ops@example.com'],
            cc: '"Support Team" <support@example.com>',
            bcc: ['audit@example.com'],
            replyTo: 'reply@example.com',
            subject: 'Invoice',
            html: '<p>Hej</p>',
            text: 'Hej',
            attachments: [
                { filename: 'a.txt', contentType: 'text/plain', content: Buffer.from('raw bytes') },
                { filename: 'b.txt', contentType: 'text/plain', content: Buffer.from('already base64').toString('base64') },
            ],
            metadata: { 'x-campaign': 'november' },
        });

        expect(acs.state.sends[0].message).toEqual({
            senderAddress: 'DoNotReply@example.azurecomm.net',
            content: { subject: 'Invoice', html: '<p>Hej</p>', plainText: 'Hej' },
            recipients: {
                to: [{ address: 'mina@example.com', displayName: 'Mina' }, { address: 'ops@example.com' }],
                cc: [{ address: 'support@example.com', displayName: 'Support Team' }],
                bcc: [{ address: 'audit@example.com' }],
            },
            replyTo: [{ address: 'reply@example.com' }],
            attachments: [
                { name: 'a.txt', contentType: 'text/plain', contentInBase64: Buffer.from('raw bytes').toString('base64') },
                { name: 'b.txt', contentType: 'text/plain', contentInBase64: Buffer.from('already base64').toString('base64') },
            ],
            headers: { 'x-campaign': 'november' },
        });
    });

    it('returns sent with the operation id as message id', async () => {
        const result = await createEmailService().send(message);
        expect(result).toEqual({ status: 'sent', messageId: acs.state.sends[0].options.operationId });
        expect(acs.state.sends[0].options.operationId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('returns failed (does not throw) when ACS rejects the send', async () => {
        acs.state.sendError = new Error('DomainNotLinked: the sender domain is not linked');
        expect(await createEmailService().send(message)).toEqual({
            status: 'failed',
            error: 'DomainNotLinked: the sender domain is not linked',
        });
    });

    it('returns failed when the operation already failed', async () => {
        acs.state.operationState = { status: 'failed', error: new Error('Recipient blocked') };
        expect(await createEmailService().send(message)).toEqual({ status: 'failed', error: 'Recipient blocked' });
    });

    it.each([
        [{ ...message, to: [] }, 'At least one recipient'],
        [{ ...message, from: '' }, 'Sender (from) is required'],
        [{ ...message, subject: '' }, 'Subject is required'],
        [{ ...message, text: undefined }, 'At least one of html or text'],
    ])('rejects an invalid message (%#)', async (invalid, error) => {
        await expect(createEmailService().send(invalid)).rejects.toThrow(error);
    });
});

describe('ACS resource', () => {
    it('uses AZURE_COMMUNICATION_RESOURCE in the default data location', async () => {
        await createEmailService().send(message);
        expect(acs.state.clients[0].args[0]).toBe('https://cnx-mail.europe.communication.azure.com');
    });

    it('uses AZURE_COMMUNICATION_DATA_LOCATION when set', async () => {
        process.env.AZURE_COMMUNICATION_DATA_LOCATION = 'switzerland';
        await createEmailService().send(message);
        expect(acs.state.clients[0].args[0]).toBe('https://cnx-mail.switzerland.communication.azure.com');
    });

    it('sends through the resource named by configurationSet', async () => {
        await createEmailService().send({ ...message, configurationSet: 'marketing' });
        expect(acs.state.clients[0].args[0]).toBe('https://marketing.europe.communication.azure.com');
    });

    it('lets configurationSet override the data location', async () => {
        await createEmailService().send({ ...message, configurationSet: 'marketing.unitedstates' });
        expect(acs.state.clients[0].args[0]).toBe('https://marketing.unitedstates.communication.azure.com');
    });

    it('throws when no resource is configured', async () => {
        delete process.env.AZURE_COMMUNICATION_RESOURCE;
        await expect(createEmailService().send(message)).rejects.toThrow('No ACS resource to send from');
    });

    it('creates one client per resource, with DefaultAzureCredential', async () => {
        const email = createEmailService();
        await email.send(message);
        await email.send(message);
        await email.send({ ...message, configurationSet: 'marketing' });

        expect(acs.state.clients).toHaveLength(2);
        expect(acs.state.clients[0].args[1]).toBeDefined(); // the credential
    });

    it('uses the connection string only for its own resource', async () => {
        const connectionString = 'endpoint=https://cnx-mail.europe.communication.azure.com/;accesskey=k';
        process.env.AZURE_COMMUNICATION_CONNECTION_STRING = connectionString;

        const email = createEmailService();
        await email.send(message);
        await email.send({ ...message, configurationSet: 'marketing' });

        expect(acs.state.clients[0].args).toEqual([connectionString]);
        expect(acs.state.clients[1].args[0]).toBe('https://marketing.europe.communication.azure.com');
    });
});

describe('azureCloudProvider', () => {
    it('creates the email service', () => {
        expect(typeof azureCloudProvider.createEmailService().send).toBe('function');
    });
});
