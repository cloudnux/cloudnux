export interface EventBrokerService {
    /**
     * Publish a message to a topic/queue
     * @param target Target topic/queue name
     * @param message Message to publish
     * @param options Optional publishing options
     * @returns Promise resolving when publishing is complete
     */
    publish(target: string, message: string | Record<string, any>, options?: PublishOptions): Promise<void>;

    /**
     * Read a message without removing it from the queue
     * @param source Source queue name
     * @param options Optional reading options
     * @returns Promise containing the peeked message(s)
     */
    peek(source: string, options?: PeekOptions): Promise<EventMessage[]>;

    /**
     * Read and remove message(s) from the queue
     * @param source Source queue name
     * @param options Optional reading options
     * @returns Promise containing the read message(s)
     */
    read(source: string, options?: ReadOptions): Promise<EventMessage[]>;
}

export interface PublishOptions {
    /** Message attributes/headers */
    attributes?: Record<string, string>;
    /** Message group ID for FIFO queues */
    messageGroupId?: string;
    /** Message deduplication ID for FIFO queues */
    messageDeduplicationId?: string;
    /** Delay in seconds before the message becomes visible */
    delaySeconds?: number;
}

export interface PeekOptions {
    /** Maximum number of messages to peek */
    maxMessages?: number;
    /** Wait time in seconds for long polling */
    waitTimeSeconds?: number;
}

export interface ReadOptions extends PeekOptions {
    /** Visibility timeout in seconds */
    visibilityTimeout?: number;
}

export interface EventMessage {
    /** Message ID */
    id: string;
    /** Message body */
    body: string;
    /** Message attributes/headers */
    attributes?: Record<string, string>;
    /** Message receipt handle (for operations like delete) */
    receiptHandle?: string;
    /** Message published timestamp */
    publishedAt: Date;
}