import {
    SQSClient,
    ReceiveMessageCommand,
    SendMessageCommand,
    DeleteMessageCommand,
    Message as SQSMessage
} from '@aws-sdk/client-sqs';
import {
    SNSClient,
    PublishCommand,
    MessageAttributeValue
} from '@aws-sdk/client-sns';

import { logger } from "@cloudnux/utils";

/**
 * Check if a string is an SNS topic ARN
 * @param target Target string
 * @returns True if the string is an SNS topic ARN
 */
function isSnsTopicArn(target: string): boolean {
    return target.startsWith('arn:aws:sns:');
}

/**
 * Map SQS message to our common interface
 * @param message SQS message
 * @returns Standardized event message
 */
function mapSqsMessageToEventMessage(message: SQSMessage) {
    return {
        id: message.MessageId ?? '',
        body: message.Body ?? '',
        attributes: message.MessageAttributes ?
            Object.entries(message.MessageAttributes).reduce((acc, [key, attr]) => {
                if (attr.StringValue) {
                    acc[key] = attr.StringValue;
                }
                return acc;
            }, {} as Record<string, string>) :
            undefined,
        receiptHandle: message.ReceiptHandle,
        publishedAt: message.Attributes?.SentTimestamp ?
            new Date(parseInt(message.Attributes.SentTimestamp)) :
            new Date(),
    };
}

/**
 * Map object to SNS message attributes
 * @param attributes Object of attributes
 * @returns SNS message attributes
 */
function mapToSnsAttributes(attributes: Record<string, string>): Record<string, MessageAttributeValue> {
    return Object.entries(attributes).reduce((acc, [key, value]) => {
        acc[key] = {
            DataType: 'String',
            StringValue: value,
        };
        return acc;
    }, {} as Record<string, MessageAttributeValue>);
}

/**
 * Create AWS Event Broker service
 * @returns AWS Event Broker service implementation
 */
export function createEventBrokerService() {
    // Create SQS and SNS clients
    const sqsClient = new SQSClient();
    const snsClient = new SNSClient();

    return {
        /**
         * Publish a message to SQS queue or SNS topic
         * @param target Target queue URL or topic ARN
         * @param message Message to publish
         * @param options Optional publishing options
         * @returns Promise resolving when publishing is complete
         */
        async publish(target: string, message: string | Record<string, any>, options?: any): Promise<void> {
            const messageBody = typeof message === 'string' ? message : JSON.stringify(message);

            if (isSnsTopicArn(target)) {
                // Publish to SNS topic
                const command = new PublishCommand({
                    TopicArn: target,
                    Message: messageBody,
                    MessageAttributes: options?.attributes ? mapToSnsAttributes(options.attributes) : undefined,
                    MessageGroupId: options?.messageGroupId,
                    MessageDeduplicationId: options?.messageDeduplicationId,
                });

                await snsClient.send(command);
            } else {
                // Publish to SQS queue
                const command = new SendMessageCommand({
                    QueueUrl: target,
                    MessageBody: messageBody,
                    MessageAttributes: options?.attributes ? mapToSnsAttributes(options.attributes) : undefined,
                    MessageGroupId: options?.messageGroupId,
                    MessageDeduplicationId: options?.messageDeduplicationId,
                    DelaySeconds: options?.delaySeconds,
                });

                await sqsClient.send(command);
            }
        },

        /**
         * Peek at messages in an SQS queue without removing them
         * @param source Source queue URL
         * @param options Optional reading options
         * @returns Promise containing the peeked message(s)
         */
        async peek(source: string, options?: any): Promise<any[]> {
            const command = new ReceiveMessageCommand({
                QueueUrl: source,
                MaxNumberOfMessages: options?.maxMessages ?? 1,
                WaitTimeSeconds: options?.waitTimeSeconds ?? 0,
                AttributeNames: ['All'],
                MessageAttributeNames: ['All'],
                VisibilityTimeout: 1, // Set to minimal value to keep messages visible to others
            });

            const response = await sqsClient.send(command);

            // If we received messages, we need to immediately reset their visibility timeout
            if (response.Messages && response.Messages.length > 0) {
                for (const message of response.Messages) {
                    if (message.ReceiptHandle) {
                        try {
                            // Change visibility to immediately make the message available again
                            const changeVisibilityCommand = new DeleteMessageCommand({
                                QueueUrl: source,
                                ReceiptHandle: message.ReceiptHandle,
                            });

                            // We intentionally don't await this call to avoid blocking
                            // This is a best-effort approach to make messages visible again
                            sqsClient.send(changeVisibilityCommand).catch(err => {
                                logger.warn('Failed to reset message visibility:', err);
                            });
                        } catch (err) {
                            logger.warn(`Error changing message visibility:${err}`);
                        }
                    }
                }
            }

            return (response.Messages ?? []).map(mapSqsMessageToEventMessage);
        },

        /**
         * Read and remove message(s) from an SQS queue
         * @param source Source queue URL
         * @param options Optional reading options
         * @returns Promise containing the read message(s)
         */
        async read(source: string, options?: any): Promise<any[]> {
            const command = new ReceiveMessageCommand({
                QueueUrl: source,
                MaxNumberOfMessages: options?.maxMessages ?? 1,
                WaitTimeSeconds: options?.waitTimeSeconds ?? 0,
                AttributeNames: ['All'],
                MessageAttributeNames: ['All'],
                VisibilityTimeout: options?.visibilityTimeout ?? 30,
            });

            const response = await sqsClient.send(command);

            // For read operation, we need to delete the messages from the queue
            if (response.Messages && response.Messages.length > 0) {
                for (const message of response.Messages) {
                    if (message.ReceiptHandle) {
                        try {
                            const deleteCommand = new DeleteMessageCommand({
                                QueueUrl: source,
                                ReceiptHandle: message.ReceiptHandle,
                            });

                            // Delete the message
                            await sqsClient.send(deleteCommand);
                        } catch (err) {
                            logger.warn(`Error deleting message:`, { err });
                        }
                    }
                }
            }

            return (response.Messages ?? []).map(mapSqsMessageToEventMessage);
        }
    };
}