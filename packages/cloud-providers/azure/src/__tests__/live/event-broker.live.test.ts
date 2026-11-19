import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { EventMessage } from '@cloudnux/core-cloud-provider';

import { createEventBrokerService } from '../../services/event-broker';
import { eventually, liveEnv, RUN_ID } from './helpers';

const ns = liveEnv.serviceBusNamespace!;

describe.skipIf(!liveEnv.serviceBusNamespace)('live: event broker (Service Bus)', () => {
    const broker = createEventBrokerService();

    const queue = `${ns}/${liveEnv.queue}`;
    const topic = `${ns}/${liveEnv.topic}`;
    const subscription = `${ns}/${liveEnv.topic}/${liveEnv.subscription}`;

    // Only messages from this run count; anything else is left over from earlier runs.
    const mine = (m: EventMessage) => m.attributes?.runId === RUN_ID;

    async function drain(source: string) {
        for (let i = 0; i < 20; i++) {
            const batch = await broker.read(source, { maxMessages: 50, waitTimeSeconds: 1 });
            if (batch.length === 0) return;
        }
    }

    /** Reads (and removes) until `count` of this run's messages arrived. */
    async function collect(source: string, count: number, timeoutMs = 20_000): Promise<EventMessage[]> {
        const found: EventMessage[] = [];
        const deadline = Date.now() + timeoutMs;
        while (found.length < count && Date.now() < deadline) {
            const batch = await broker.read(source, { maxMessages: 10, waitTimeSeconds: 2 });
            found.push(...batch.filter(mine));
        }
        expect(found, `messages received from ${source}`).toHaveLength(count);
        return found;
    }

    beforeAll(async () => {
        await drain(queue);
        await drain(subscription);
    });

    afterAll(async () => {
        await drain(queue);
        await drain(subscription);
    });

    it('peek leaves the message in place; read removes it', async () => {
        await broker.publish(queue, { step: 'peek' }, { attributes: { runId: RUN_ID } });
        const first = await eventually(
            async () => (await broker.peek(queue, { maxMessages: 10 })).find(mine),
            { what: 'the message to be peekable' }
        );
        const second = (await broker.peek(queue, { maxMessages: 10 })).find(mine);
        expect(second, 'still there after the first peek').toBeDefined();
        expect(second!.body).toBe(first.body);
        expect(second!.publishedAt.getTime()).toBe(first.publishedAt.getTime());

        const [received] = await collect(queue, 1);
        expect(received.body).toBe('{"step":"peek"}');

        expect((await broker.peek(queue, { maxMessages: 10 })).filter(mine)).toHaveLength(0);
    });

    it('round-trips string and object bodies, attributes, and the dedup id as message id', async () => {
        const before = Date.now();
        await broker.publish(queue, 'plain text – åäö', {
            attributes: { runId: RUN_ID, kind: 'string' },
            messageDeduplicationId: `str-${RUN_ID}`,
        });
        await broker.publish(queue, { orderId: 42, nested: { ok: true } }, {
            attributes: { runId: RUN_ID, kind: 'object', tenant: 'acme' },
        });

        const messages = await collect(queue, 2);
        const text = messages.find(m => m.attributes?.kind === 'string')!;
        const object = messages.find(m => m.attributes?.kind === 'object')!;

        expect(text.body).toBe('plain text – åäö');
        expect(text.id).toBe(`str-${RUN_ID}`);

        expect(JSON.parse(object.body)).toEqual({ orderId: 42, nested: { ok: true } });
        expect(object.attributes).toEqual({ runId: RUN_ID, kind: 'object', tenant: 'acme' });

        // Enqueue time comes from the service; allow for some clock skew.
        expect(object.publishedAt.getTime()).toBeGreaterThan(before - 60_000);
        expect(object.publishedAt.getTime()).toBeLessThan(Date.now() + 60_000);
    });

    it('delivers topic messages to the subscription', async () => {
        await broker.publish(topic, { event: 'invoice.created' }, { attributes: { runId: RUN_ID } });
        const [message] = await collect(subscription, 1);
        expect(JSON.parse(message.body)).toEqual({ event: 'invoice.created' });
    });

    it('delaySeconds holds the message back until it is due', async () => {
        const sentAt = Date.now();
        await broker.publish(queue, 'later', { attributes: { runId: RUN_ID, kind: 'delayed' }, delaySeconds: 8 });

        const early = await broker.read(queue, { maxMessages: 10, waitTimeSeconds: 2 });
        expect(early.filter(mine), 'not delivered before it is due').toHaveLength(0);

        const [late] = await collect(queue, 1, 30_000);
        expect(late.body).toBe('later');
        // Scheduled time is computed from this machine's clock, so allow ~3 s of skew.
        expect(Date.now() - sentAt).toBeGreaterThanOrEqual(5_000);
    }, 45_000);
});
