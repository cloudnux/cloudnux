import { describe, expect, it } from 'vitest';

import { createEmailService } from '../../services/email';
import { liveEnv, RUN_ID } from './helpers';

// Uses AZURE_COMMUNICATION_RESOURCE (and the connection string, unless LIVE_AUTH=entra).
describe.skipIf(!liveEnv.emailFrom)('live: email (Communication Services)', () => {
    const email = createEmailService();
    const from = liveEnv.emailFrom!;

    it.skipIf(!liveEnv.emailTo)('sends a message ACS accepts (check the LIVE_EMAIL_TO inbox)', async () => {
        const result = await email.send({
            from,
            to: liveEnv.emailTo!,
            subject: `cloudnux live test ${RUN_ID}`,
            text: `Sent by the cloudnux Azure email live test, run ${RUN_ID}.`,
            html: `<p>Sent by the cloudnux Azure email live test, run <b>${RUN_ID}</b>.</p>`,
            attachments: [{ filename: 'run.txt', contentType: 'text/plain', content: Buffer.from(RUN_ID) }],
        });

        expect(result).toEqual({ status: 'sent', messageId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    });

    it('returns failed, without throwing, for a sender domain that is not linked', async () => {
        const result = await email.send({
            from: 'nobody@example.com',
            to: 'nobody@example.com',
            subject: 'never sent',
            text: 'never sent',
        });

        expect(result.status).toBe('failed');
        expect(result).toHaveProperty('error', expect.any(String));
    });
});
