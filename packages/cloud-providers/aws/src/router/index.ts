import {
    APIGatewayProxyEventV2,
    APIGatewayProxyResultV2,
    SNSEvent,
    SQSEvent,
    ScheduledEvent,
    S3Event,
    Context,
    SNSEventRecord,
    SQSRecord,
    S3EventRecord
} from 'aws-lambda';

import { HttpMethod, MessageFilter } from "@cloudnux/core-cloud-provider"

export type EventType = APIGatewayProxyEventV2 | SNSEvent | SQSEvent | ScheduledEvent | S3Event;

export type EventHndlerType = APIGatewayProxyEventV2 | SNSEventRecord | SQSRecord | ScheduledEvent | S3EventRecord | any;
export type HandlerFunction = (event: EventHndlerType, context: Context) => Promise<any>;

export interface RouteDefinition {
    type: 'http' | 'schedule' | 'event';
    handler: HandlerFunction;
    // HTTP specific
    method?: HttpMethod;
    routeKey?: string;
    // Schedule specific  
    pattern?: string;
    name?: string;
    // Event specific
    source?: string;
    sourceType?: string;
    filter?: MessageFilter;
}

export function createRouter() {

    const routes: RouteDefinition[] = [];

    function detectEventType(event: EventType): string {
        if ('requestContext' in event && 'http' in event.requestContext) {
            return 'http';
        }
        if ('source' in event && event.source === 'aws.events') {
            return 'schedule';
        }
        if ('Records' in event) {
            return 'event';
        }
        return 'unknown';
    }
    function getEventSourceInfo(event: any): {
        type: "sns" | "sqs" | "s3" | "dynamodb" | "eventbridge" | "kinesis" | "unknown";
        name: string;
        arn?: string
    } {
        // SQS Event
        if ('Records' in event && event.Records?.[0]?.eventSource === 'aws:sqs') {
            const record = event.Records[0];
            const queueArn = record.eventSourceARN;
            // Extract queue name from ARN: arn:aws:sqs:region:account:queue-name
            const queueName = queueArn.split(':').pop();
            return {
                type: 'sqs',
                name: queueName,
                arn: queueArn
            };
        }

        // SNS Event
        if ('Records' in event && event.Records?.[0]?.EventSource === 'aws:sns') {
            const record = event.Records[0];
            const topicArn = record.Sns.TopicArn;
            // Extract topic name from ARN: arn:aws:sns:region:account:topic-name
            const topicName = topicArn.split(':').pop();
            return {
                type: 'sns',
                name: topicName,
                arn: topicArn
            };
        }

        // S3 Event
        if ('Records' in event && event.Records?.[0]?.eventSource === 'aws:s3') {
            const record = event.Records[0];
            const bucketName = record.s3.bucket.name;
            const bucketArn = record.s3.bucket.arn;
            return {
                type: 's3',
                name: bucketName,
                arn: bucketArn
            };
        }

        // DynamoDB Event
        if ('Records' in event && event.Records?.[0]?.eventSource === 'aws:dynamodb') {
            const record = event.Records[0];
            const tableArn = record.eventSourceARN;
            // Extract table name from ARN: arn:aws:dynamodb:region:account:table/table-name/stream/...
            const tableName = tableArn.split('/')[1];
            return {
                type: 'dynamodb',
                name: tableName,
                arn: tableArn
            };
        }

        // EventBridge/CloudWatch Events
        if ('source' in event && 'detail-type' in event) {
            return {
                type: 'eventbridge',
                name: event.source,
                arn: event.source
            };
        }

        // Kinesis Event
        if ('Records' in event && event.Records?.[0]?.eventSource === 'aws:kinesis') {
            const record = event.Records[0];
            const streamArn = record.eventSourceARN;
            // Extract stream name from ARN: arn:aws:kinesis:region:account:stream/stream-name
            const streamName = streamArn.split('/').pop();
            return {
                type: 'kinesis',
                name: streamName,
                arn: streamArn
            };
        }

        return {
            type: 'unknown',
            name: 'unknown'
        };
    }

    async function handleHttpEvent(
        event: APIGatewayProxyEventV2,
        context: Context,
        routes: RouteDefinition[]
    ): Promise<APIGatewayProxyResultV2> {
        const method = event.requestContext.http.method as HttpMethod;
        //remove the "HTTP" prefix from the routeKey
        const routeKey = event.routeKey.split(" ")[0].toLowerCase();

        for (const route of routes) {
            if (route.type === 'http' &&
                route.method === method &&
                route.routeKey === routeKey) {
                try {
                    const result = await route.handler(event, context);
                    return result;
                } catch (error) {
                    return {
                        statusCode: 500,
                        body: JSON.stringify({
                            error: 'Internal Server Error',
                            message: error instanceof Error ? error.message : 'Unknown error'
                        })
                    };
                }

            }
        }

        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Not Found' })
        };
    }
    async function handleScheduleEvent(
        event: ScheduledEvent,
        context: Context,
        routes: RouteDefinition[]
    ): Promise<any> {
        const ndx = event.resources[0].lastIndexOf("/");
        const name = event.resources[0].substring(ndx + 1, event.resources[0].length);

        for (const route of routes) {
            if (route.type === 'schedule' &&
                route.name === name) {
                try {
                    return await route.handler(event, context);
                } catch (error) {
                    throw error;
                }
            }
        }
        throw new Error('No schedule handler found');
    }
    async function handleEventBrokerEvent(
        event: EventType,
        context: Context,
        routes: RouteDefinition[]
    ): Promise<any> {
        const eventSourceInfo = getEventSourceInfo(event);
        // Handle SNS, SQS
        for (const route of routes) {
            if (route.type === 'event' &&
                eventSourceInfo.type === route.sourceType &&
                eventSourceInfo.name === route.source) {
                const eventMessage = event as SNSEvent | SQSEvent | S3Event;
                try {
                    return await Promise.all(eventMessage.Records.map(record => {
                        return route.handler(record, context);
                    }));
                } catch (error) {
                    throw error;
                }
            }
        }

        throw new Error('No event handler found');
    }

    return {
        // Register HTTP route
        http(method: HttpMethod, route: string, handler: HandlerFunction) {
            routes.push({
                type: 'http',
                method,
                routeKey: route,
                handler
            });
        },

        // Register schedule route
        schedule(name: string, pattern: string, handler: HandlerFunction) {
            routes.push({
                type: 'schedule',
                name,
                pattern,
                handler
            });
        },

        // Register event route SNS / SQS / EventBridge
        event(source: string, sourceType: string, handler: HandlerFunction, filter?: MessageFilter) {
            routes.push({
                type: 'event',
                source,
                sourceType,
                filter,
                handler
            });
        },

        async run(event: EventType, context: Context): Promise<any> {
            const eventType = detectEventType(event);

            switch (eventType) {
                case 'http':
                    return await handleHttpEvent(event as APIGatewayProxyEventV2, context, routes);
                case 'schedule':
                    return await handleScheduleEvent(event as ScheduledEvent, context, routes);
                case 'event':
                    return await handleEventBrokerEvent(event, context, routes);
                default:
                    throw new Error(`Unsupported event type: ${eventType}`);
            }
        }
    };
}