import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

import { EmailAttachment, EmailMessage, EmailSendResult, EmailService } from '@cloudnux/core-cloud-provider';

function toArray(value?: string | string[]): string[] | undefined {
    if (!value) return undefined;
    const array = Array.isArray(value) ? value : [value];
    return array.length ? array : undefined;
}

function toRawContent(attachment: EmailAttachment): Buffer {
    return Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(attachment.content, 'base64');
}

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

/**
 * Create AWS SES email service
 * @returns AWS SESv2-backed email service implementation
 */
export function createEmailService(): EmailService {

    // Create SESv2 client
    const sesClient = new SESv2Client();

    return {
        /**
         * Send an email via SES v2's SendEmail API. Attachments are passed
         * through Content.Simple.Attachments directly - SES assembles the
         * MIME message, no raw MIME building needed on our side.
         * @param message Email to send
         * @returns Promise resolving with the send result
         */
        async send(message: EmailMessage): Promise<EmailSendResult> {
            assertValidMessage(message);

            const command = new SendEmailCommand({
                FromEmailAddress: message.from,
                Destination: {
                    ToAddresses: toArray(message.to),
                    CcAddresses: toArray(message.cc),
                    BccAddresses: toArray(message.bcc),
                },
                ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
                ConfigurationSetName: message.configurationSet,
                Content: {
                    Simple: {
                        Subject: { Data: message.subject, Charset: 'UTF-8' },
                        Body: {
                            Html: message.html ? { Data: message.html, Charset: 'UTF-8' } : undefined,
                            Text: message.text ? { Data: message.text, Charset: 'UTF-8' } : undefined,
                        },
                        Attachments: message.attachments?.map((attachment) => ({
                            FileName: attachment.filename,
                            ContentType: attachment.contentType,
                            RawContent: toRawContent(attachment),
                            ContentDisposition: 'ATTACHMENT' as const,
                        })),
                    },
                },
                EmailTags: message.metadata
                    ? Object.entries(message.metadata).map(([Name, Value]) => ({ Name, Value }))
                    : undefined,
            });

            try {
                const response = await sesClient.send(command);

                if (!response.MessageId) {
                    return { status: 'failed', error: 'SES did not return a message id' };
                }

                return { status: 'sent', messageId: response.MessageId };
            } catch (error) {
                return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
            }
        },
    };
}
