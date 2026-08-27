import { IService } from "../cloud-container";

export type EmailAddress = string; // "name@domain.com" — keep it simple unless you need display names

export type EmailAttachment = {
    filename: string;
    content: Buffer | string; // string assumed base64 if not Buffer
    contentType: string;
};

export type EmailMessage = {
    to: EmailAddress | EmailAddress[];
    from: EmailAddress;
    subject: string;
    html?: string;
    text?: string;
    replyTo?: EmailAddress;
    cc?: EmailAddress | EmailAddress[];
    bcc?: EmailAddress | EmailAddress[];
    attachments?: EmailAttachment[];

    /**
     * Provider-specific passthrough (SES tags, ACS headers, etc).
     * Adapters may use this; handlers should avoid depending on it
     * to stay provider-agnostic.
     */
    metadata?: Record<string, string>;
};

export type EmailSendResult =
    | { status: "sent"; messageId: string }
    | { status: "failed"; error: string };

export interface EmailService extends IService {
    send(message: EmailMessage): Promise<EmailSendResult>;
}
