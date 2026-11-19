import Long from 'long';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEventBrokerService } from '../../services/event-broker';
import { azureCloudProvider } from '../../index';

// ---------------------------------------------------------------------------
// Fake Service Bus SDK. Tests go through the public service only; the fake
// records what the service asked the SDK to do.
// ---------------------------------------------------------------------------

const bus = vi.hoisted(() => {
    const state = {
        clients: [] as Array<{ args: unknown[] }>,
        senders: [] as Array<{ entity: string; sent: unknown[]; closed: boolean }>,
        receivers: [] as Array<{ args: unknown[]; closed: boolean; peekedFrom: number[] }>,
        messages: [] as Array<{ sequenceNumber?: Long; [field: string]: unknown }>,
        failPeek: false,
        // Like Service Bus, one peek may return fewer messages than asked for.
        peekBatchLimit: Infinity,
    };

    class ServiceBusClient {
        constructor(...args: unknown[]) {
            state.clients.push({ args });
        }
        createSender(entity: string) {
            const sender = { entity, sent: [] as unknown[], closed: false };
            state.senders.push(sender);
            return {
                sendMessages: async (message: unknown) => { sender.sent.push(message); },
                close: async () => { sender.closed = true; },
            };
        }
        createReceiver(...args: unknown[]) {
            const receiver = { args, closed: false, peekedFrom: [] as number[] };
            state.receivers.push(receiver);
            return {
                peekMessages: async (count: number, options: { fromSequenceNumber: Long }) => {
                    if (state.failPeek) throw new Error('link detached');
                    const from = options.fromSequenceNumber.toNumber();
                    receiver.peekedFrom.push(from);
                    return state.messages
                        .filter(m => m.sequenceNumber!.toNumber() >= from)
                        .slice(0, Math.min(count, state.peekBatchLimit));
                },
                receiveMessages: async () => state.messages,
                close: async () => { receiver.closed = true; },
            };
        }
    }

    return { state, ServiceBusClient };
});

vi.mock('@azure/service-bus', () => ({ ServiceBusClient: bus.ServiceBusClient }));
vi.mock('@azure/identity', () => ({ DefaultAzureCredential: class DefaultAzureCredential { } }));

const receivedMessage = {
    sequenceNumber: Long.fromNumber(1),
    messageId: 'm-1',
    body: '{"orderId":1}',
    applicationProperties: { tenant: 'acme', retries: 2, at: new Date('2026-11-12T09:00:00Z') },
    enqueuedTimeUtc: new Date('2026-11-12T10:00:00Z'),
    lockToken: undefined,
};

beforeEach(() => {
    bus.state.clients.length = 0;
    bus.state.senders.length = 0;
    bus.state.receivers.length = 0;
    bus.state.messages = [];
    bus.state.failPeek = false;
    bus.state.peekBatchLimit = Infinity;
    delete process.env.AZURE_SERVICEBUS_CONNECTION_STRING;
});

// ---------------------------------------------------------------------------

describe('publish', () => {
    it('sends to the queue or topic in the target namespace, then closes the sender', async () => {
        await createEventBrokerService().publish('myns/orders', { orderId: 1 }, { attributes: { tenant: 'acme' } });

        const [sender] = bus.state.senders;
        expect(sender.entity).toBe('orders');
        expect(sender.sent).toEqual([{
            body: '{"orderId":1}',
            contentType: 'application/json',
            applicationProperties: { tenant: 'acme' },
        }]);
        expect(sender.closed).toBe(true);
    });

    it('sends strings as text', async () => {
        await createEventBrokerService().publish('myns/orders', 'hello');
        expect(bus.state.senders[0].sent).toEqual([{ body: 'hello', contentType: 'text/plain' }]);
    });

    it('maps group id, dedup id and delay', async () => {
        const before = Date.now();
        await createEventBrokerService().publish('myns/orders', 'x', {
            messageGroupId: 'charger-7',
            messageDeduplicationId: 'evt-123',
            delaySeconds: 30,
        });

        const [sent] = bus.state.senders[0].sent as Array<{ sessionId: string; messageId: string; scheduledEnqueueTimeUtc: Date }>;
        expect(sent.sessionId).toBe('charger-7');
        expect(sent.messageId).toBe('evt-123');
        const delayMs = sent.scheduledEnqueueTimeUtc.getTime() - before;
        expect(delayMs).toBeGreaterThanOrEqual(30_000);
        expect(delayMs).toBeLessThan(31_000);
    });

    it('rejects a subscription address', async () => {
        await expect(createEventBrokerService().publish('myns/events/billing', 'x'))
            .rejects.toThrow('Cannot publish to a subscription');
    });
});

describe('peek', () => {
    it('peeks a queue in peek-lock mode and closes the receiver', async () => {
        bus.state.messages = [receivedMessage];
        const messages = await createEventBrokerService().peek('myns/orders', { maxMessages: 5 });

        expect(bus.state.receivers[0].args).toEqual(['orders', { receiveMode: 'peekLock' }]);
        expect(bus.state.receivers[0].closed).toBe(true);
        expect(messages).toEqual([{
            id: 'm-1',
            body: '{"orderId":1}',
            attributes: { tenant: 'acme', retries: '2', at: '2026-11-12T09:00:00.000Z' },
            receiptHandle: undefined,
            publishedAt: new Date('2026-11-12T10:00:00Z'),
        }]);
    });

    it('starts from the oldest message on every call', async () => {
        bus.state.messages = [receivedMessage];
        const broker = createEventBrokerService();
        const first = await broker.peek('myns/orders', { maxMessages: 10 });
        const second = await broker.peek('myns/orders', { maxMessages: 10 });

        expect(second).toEqual(first);
        expect(bus.state.receivers.map(r => r.peekedFrom[0])).toEqual([1, 1]);
    });

    it('keeps peeking when Service Bus returns short batches', async () => {
        bus.state.peekBatchLimit = 2;
        bus.state.messages = [1, 2, 3, 4, 5].map(n => ({ ...receivedMessage, sequenceNumber: Long.fromNumber(n), messageId: `m-${n}` }));

        const four = await createEventBrokerService().peek('myns/orders', { maxMessages: 4 });
        expect(four.map(m => m.id)).toEqual(['m-1', 'm-2', 'm-3', 'm-4']);
        expect(bus.state.receivers[0].peekedFrom).toEqual([1, 3]);

        const all = await createEventBrokerService().peek('myns/orders', { maxMessages: 10 });
        expect(all.map(m => m.id)).toEqual(['m-1', 'm-2', 'm-3', 'm-4', 'm-5']);
        expect(bus.state.receivers[1].peekedFrom).toEqual([1, 3, 5, 6]); // stops on the empty batch
    });

    it('peeks a topic subscription', async () => {
        await createEventBrokerService().peek('myns/events/billing');
        expect(bus.state.receivers[0].args).toEqual(['events', 'billing', { receiveMode: 'peekLock' }]);
    });

    it('closes the receiver even when peek fails', async () => {
        bus.state.failPeek = true;
        await expect(createEventBrokerService().peek('myns/orders')).rejects.toThrow('link detached');
        expect(bus.state.receivers[0].closed).toBe(true);
    });
});

describe('read', () => {
    it('reads in receive-and-delete mode and closes the receiver', async () => {
        bus.state.messages = [receivedMessage];
        const messages = await createEventBrokerService().read('myns/events/billing');

        expect(bus.state.receivers[0].args).toEqual(['events', 'billing', { receiveMode: 'receiveAndDelete' }]);
        expect(bus.state.receivers[0].closed).toBe(true);
        expect(messages).toHaveLength(1);
    });

    it('turns non-string bodies into strings', async () => {
        bus.state.messages = [
            { ...receivedMessage, body: { a: 1 } },
            { ...receivedMessage, body: Buffer.from('raw') },
            { ...receivedMessage, body: undefined, applicationProperties: undefined },
        ];
        const [json, binary, empty] = await createEventBrokerService().read('myns/orders');
        expect(json.body).toBe('{"a":1}');
        expect(binary.body).toBe('raw');
        expect(empty.body).toBe('');
        expect(empty.attributes).toBeUndefined();
    });
});

describe('addresses and connections', () => {
    it.each(['orders', 'myns/', '/orders', 'myns/a/b/c', 'myns/a/'])('rejects %j', async (address) => {
        await expect(createEventBrokerService().read(address)).rejects.toThrow('Invalid Service Bus address');
    });

    it('opens one connection per namespace, with DefaultAzureCredential', async () => {
        const broker = createEventBrokerService();
        await broker.publish('ns1/a', 'x');
        await broker.publish('ns1/b', 'y');
        await broker.read('ns2/a');

        expect(bus.state.clients).toHaveLength(2);
        expect(bus.state.clients[0].args[0]).toBe('ns1.servicebus.windows.net');
        expect(bus.state.clients[1].args[0]).toBe('ns2.servicebus.windows.net');
        expect(bus.state.clients[0].args[1]).toBeDefined(); // the credential
    });

    it('uses a full host name as given', async () => {
        await createEventBrokerService().publish('myns.servicebus.usgovcloudapi.net/orders', 'x');
        expect(bus.state.clients[0].args[0]).toBe('myns.servicebus.usgovcloudapi.net');
    });

    it('uses the connection string only for its own namespace', async () => {
        const connectionString = 'Endpoint=sb://myns.servicebus.windows.net/;SharedAccessKeyName=Root;SharedAccessKey=k';
        process.env.AZURE_SERVICEBUS_CONNECTION_STRING = connectionString;

        const broker = createEventBrokerService();
        await broker.publish('myns/orders', 'x');
        await broker.publish('otherns/orders', 'x');

        expect(bus.state.clients[0].args).toEqual([connectionString]);
        expect(bus.state.clients[1].args[0]).toBe('otherns.servicebus.windows.net');
    });

    it('matches the emulator connection string by namespace "localhost"', async () => {
        const connectionString = 'Endpoint=sb://localhost;SharedAccessKeyName=Root;SharedAccessKey=k;UseDevelopmentEmulator=true;';
        process.env.AZURE_SERVICEBUS_CONNECTION_STRING = connectionString;
        await createEventBrokerService().publish('localhost/orders', 'x');
        expect(bus.state.clients[0].args).toEqual([connectionString]);
    });
});

describe('azureCloudProvider', () => {
    it('creates the event broker service', () => {
        expect(typeof azureCloudProvider.createEventBrokerService().publish).toBe('function');
    });
});
