import { DefaultAzureCredential } from '@azure/identity';
import { ServiceBusClient, ServiceBusMessage, ServiceBusReceivedMessage } from '@azure/service-bus';
import Long from 'long';

import { EventBrokerService, EventMessage, PublishOptions } from '@cloudnux/core-cloud-provider';
import { env } from '@cloudnux/utils';

/**
 * Event broker on Azure Service Bus.
 *
 * Addresses:
 *   publish      "<namespace>/<queue>"  or  "<namespace>/<topic>"
 *   peek, read   "<namespace>/<queue>"  or  "<namespace>/<topic>/<subscription>"
 *
 * <namespace> is a namespace name ("myns" means myns.servicebus.windows.net)
 * or a full host name.
 *
 * Auth: AZURE_SERVICEBUS_CONNECTION_STRING if it is for that namespace
 * (emulator, CI), otherwise DefaultAzureCredential.
 */
export function createEventBrokerService(): EventBrokerService {
    // One connection per namespace, opened on first use.
    const clients = new Map<string, ServiceBusClient>();

    function clientFor(namespace: string): ServiceBusClient {
        let client = clients.get(namespace);
        if (!client) {
            client = connect(namespace);
            clients.set(namespace, client);
        }
        return client;
    }

    function openReceiver(source: string, receiveMode: 'peekLock' | 'receiveAndDelete') {
        const { namespace, entity, subscription } = parseAddress(source);
        const client = clientFor(namespace);
        return subscription
            ? client.createReceiver(entity, subscription, { receiveMode })
            : client.createReceiver(entity, { receiveMode });
    }

    return {
        async publish(target, message, options) {
            const { namespace, entity, subscription } = parseAddress(target);
            if (subscription) {
                throw new Error(`Cannot publish to a subscription ("${target}"); publish to the topic "${namespace}/${entity}".`);
            }

            const sender = clientFor(namespace).createSender(entity);
            try {
                await sender.sendMessages(toServiceBusMessage(message, options));
            } finally {
                await sender.close();
            }
        },

        // Peek never removes or locks messages. It always starts from the oldest message.
        async peek(source, options) {
            const maxMessages = options?.maxMessages ?? 1;
            const receiver = openReceiver(source, 'peekLock');
            try {
                // We pass the start position on every call because:
                // - without it, the SDK continues after the last message peeked on this
                //   connection, even by an earlier receiver, so a second peek skips messages;
                // - one call can return fewer messages than asked for, so we keep going
                //   until we have enough or the queue has no more.
                const messages: ServiceBusReceivedMessage[] = [];
                let fromSequenceNumber = Long.ONE;
                while (messages.length < maxMessages) {
                    const batch = await receiver.peekMessages(maxMessages - messages.length, { fromSequenceNumber });
                    if (batch.length === 0) break;
                    messages.push(...batch);
                    fromSequenceNumber = batch[batch.length - 1].sequenceNumber!.add(1);
                }
                return messages.map(toEventMessage);
            } finally {
                await receiver.close();
            }
        },

        // Messages are removed as they are delivered (receive-and-delete).
        // visibilityTimeout has no per-call equivalent on Service Bus and is ignored.
        async read(source, options) {
            const receiver = openReceiver(source, 'receiveAndDelete');
            try {
                // Wait at least 1 s: a shorter wait can return before the receiver is connected.
                const waitSeconds = Math.max(options?.waitTimeSeconds ?? 0, 1);
                const messages = await receiver.receiveMessages(options?.maxMessages ?? 1, {
                    maxWaitTimeInMs: waitSeconds * 1000,
                });
                return messages.map(toEventMessage);
            } finally {
                await receiver.close();
            }
        },
    };
}

// ---------------------------------------------------------------------------
// Connection and addresses
// ---------------------------------------------------------------------------

function connect(namespace: string): ServiceBusClient {
    const host = namespace.includes('.') ? namespace : `${namespace}.servicebus.windows.net`;

    const connectionString = env('AZURE_SERVICEBUS_CONNECTION_STRING');
    const connectionStringHost = connectionString && /Endpoint=sb:\/\/([^/;]+)/i.exec(connectionString)?.[1];
    if (connectionStringHost === host || connectionStringHost === namespace) {
        return new ServiceBusClient(connectionString);
    }

    return new ServiceBusClient(host, new DefaultAzureCredential());
}

function parseAddress(address: string) {
    const [namespace, entity, subscription, ...extra] = (address ?? '').split('/');
    if (!namespace || !entity || subscription === '' || extra.length > 0) {
        throw new Error(
            `Invalid Service Bus address "${address}": expected "<namespace>/<queue or topic>" ` +
            `or "<namespace>/<topic>/<subscription>".`
        );
    }
    return { namespace, entity, subscription };
}

// ---------------------------------------------------------------------------
// Message mapping
// ---------------------------------------------------------------------------

function toServiceBusMessage(message: string | Record<string, any>, options: PublishOptions = {}): ServiceBusMessage {
    const isText = typeof message === 'string';
    return {
        // Bodies are sent as strings, as on AWS, so consumers get the same body on every cloud.
        body: isText ? message : JSON.stringify(message),
        contentType: isText ? 'text/plain' : 'application/json',
        applicationProperties: options.attributes,
        sessionId: options.messageGroupId,
        messageId: options.messageDeduplicationId,
        scheduledEnqueueTimeUtc: options.delaySeconds
            ? new Date(Date.now() + options.delaySeconds * 1000)
            : undefined,
    };
}

function toEventMessage(message: ServiceBusReceivedMessage): EventMessage {
    const attributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(message.applicationProperties ?? {})) {
        attributes[key] = value instanceof Date ? value.toISOString() : String(value);
    }

    return {
        id: String(message.messageId ?? ''),
        body: bodyAsString(message.body),
        attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
        receiptHandle: message.lockToken,
        publishedAt: message.enqueuedTimeUtc ?? new Date(),
    };
}

// Our publish always sends a string, but other producers may send JSON or binary.
function bodyAsString(body: unknown): string {
    if (typeof body === 'string') return body;
    if (body === undefined || body === null) return '';
    if (Buffer.isBuffer(body)) return body.toString('utf-8');
    return JSON.stringify(body);
}
