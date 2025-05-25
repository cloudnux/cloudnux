import axios from 'axios';

import { env } from "@cloudnux/utils";

import { EventBrokerService, EventMessage, PeekOptions, PublishOptions, ReadOptions } from "@cloudnux/core-cloud-provider";
/**
 * Create an HTTP-based event broker service 
 * Communicates with a message queue system over HTTP endpoints
 * @returns HTTP event broker service implementation
 */
export function createLocalEventBrokerService(): EventBrokerService {
    // Get base URL from environment variables or use default
    const baseURL = env("DEV_CLOUD_EVENT_BROKER_URL", 'http://localhost:3000');

    /**
     * Get the full URL for a queue
     * @param queueName Queue name
     * @returns Full URL for the queue endpoint
     */
    function getQueueUrl(queueName: string): string {
        // If queue name already contains a full URL, use it as is
        if (queueName.startsWith('http://') || queueName.startsWith('https://')) {
            return queueName;
        }

        // Otherwise, append it to the base URL
        return `${baseURL}/${queueName}`;
    }

    /**
     * Parse response data into EventMessage format
     * @param data Response data
     * @returns EventMessage object
     */
    function parseMessage(data: any): EventMessage {
        // Handle string body
        const body = typeof data.body === 'object'
            ? JSON.stringify(data.body)
            : data.body || '';

        return {
            id: data.id || data.messageId || '',
            body,
            attributes: data.attributes || {},
            receiptHandle: data.receiptHandle || data.id || '',
            publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date()
        };
    }

    return {
        /**
         * Publish a message to an HTTP queue endpoint
         * @param target Target queue name or URL
         * @param message Message to publish
         * @param options Optional publishing options
         * @returns Promise resolving when publishing is complete
         */
        async publish(target: string, message: string | Record<string, any>, options?: PublishOptions): Promise<void> {
            const queueUrl = getQueueUrl(target);
            const headers: Record<string, string> = {};

            // Add message attributes as headers
            if (options?.attributes) {
                Object.entries(options.attributes).forEach(([key, value]) => {
                    headers[key] = value;
                });
            }

            // Add FIFO properties as headers if specified
            if (options?.messageGroupId) {
                headers['x-message-group-id'] = options.messageGroupId;
            }

            if (options?.messageDeduplicationId) {
                headers['x-message-deduplication-id'] = options.messageDeduplicationId;
            }

            if (options?.delaySeconds) {
                headers['x-delay-seconds'] = options.delaySeconds.toString();
            }

            // Prepare message body
            const body = typeof message === 'string' ? message : message;

            // Send POST request to publish the message
            await axios.post(queueUrl, body, { headers });
        },

        /**
         * Peek at messages in a queue without removing them
         * @param source Source queue name or URL
         * @param options Optional reading options
         * @returns Promise containing the peeked message(s)
         */
        async peek(source: string, options?: PeekOptions): Promise<EventMessage[]> {
            const queueUrl = getQueueUrl(source);
            const params: Record<string, string> = {
                peek: 'true'
            };

            // Add options as query parameters
            if (options?.maxMessages) {
                params.maxMessages = options.maxMessages.toString();
            }

            if (options?.waitTimeSeconds) {
                params.waitTimeSeconds = options.waitTimeSeconds.toString();
            }

            // Send GET request to peek at messages
            const response = await axios.get(queueUrl, { params });

            // Parse response data
            const messages = Array.isArray(response.data)
                ? response.data.map(parseMessage)
                : response.data ? [parseMessage(response.data)] : [];

            return messages;
        },

        /**
         * Read and remove message(s) from a queue
         * @param source Source queue name or URL
         * @param options Optional reading options
         * @returns Promise containing the read message(s)
         */
        async read(source: string, options?: ReadOptions): Promise<EventMessage[]> {
            const queueUrl = getQueueUrl(source);
            const params: Record<string, string> = {};

            // Add options as query parameters
            if (options?.maxMessages) {
                params.maxMessages = options.maxMessages.toString();
            }

            if (options?.waitTimeSeconds) {
                params.waitTimeSeconds = options.waitTimeSeconds.toString();
            }

            if (options?.visibilityTimeout) {
                params.visibilityTimeout = options.visibilityTimeout.toString();
            }

            // Send DELETE request to read and remove messages
            // DELETE is used to indicate that messages should be removed after reading
            const response = await axios.delete(queueUrl, { params });

            // Parse response data
            const messages = Array.isArray(response.data)
                ? response.data.map(parseMessage)
                : response.data ? [parseMessage(response.data)] : [];

            return messages;
        }
    };
}