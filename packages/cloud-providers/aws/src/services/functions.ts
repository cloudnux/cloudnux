import { APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context, ScheduledEvent, SQSRecord, SNSEventRecord } from "aws-lambda";
import { SQSClient, ChangeMessageVisibilityCommand } from "@aws-sdk/client-sqs";
import {
    FunctionsService, HttpMethod,
    HTTPRequest, HttpFunctionContext,
    ScheduleRequest,
    EventRequest, EventFunctionContext, EventBatchItemResult,
    WebSocketRequest, WebSocketFunctionContext,
    WebSocketTrigger,
    InvokeRequest, InvokeFunctionContext,
} from "@cloudnux/core-cloud-provider";

// Union type for supported event types
type EventRecord = SQSRecord | SNSEventRecord;
const isSQSRecord = (event: EventRecord): event is SQSRecord => {
    return 'messageId' in event && 'body' in event && !('EventSource' in event);
};

const isSNSRecord = (event: EventRecord): event is SNSEventRecord => {
    return 'EventSource' in event && event.EventSource === 'aws:sns';
};

// Helper function to convert AWS message attributes to simple key-value pairs
const convertMessageAttributes = (messageAttributes: any): Record<string, string> => {
    if (!messageAttributes) return {};

    const converted: Record<string, string> = {};
    for (const [key, value] of Object.entries(messageAttributes)) {
        if (typeof value === 'object' && value !== null && 'stringValue' in value) {
            converted[key] = (value as any).stringValue;
        } else if (typeof value === 'string') {
            converted[key] = value;
        }
    }
    return converted;
};


//helper function to extract path parameters based on a template, e.g. /users/{userId} with actual path /users/123 would return { userId: "123" }
function extractParams(template: string, actualPath: string): Record<string, string> | null {
    const templateParts = template.split('/').filter(Boolean);
    const pathParts = actualPath.split('/').filter(Boolean);

    if (templateParts.length !== pathParts.length) return null;

    const params: Record<string, string> = {};
    for (let i = 0; i < templateParts.length; i++) {
        const match = templateParts[i].match(/^\{(\w+)\}$/);
        if (match) {
            params[match[1]] = pathParts[i];
        } else if (templateParts[i] !== pathParts[i]) {
            return null;
        }
    }
    return params;
}

export function createFunctionsService(): FunctionsService {
    return {
        createHttRequest(event: APIGatewayProxyEventV2, ctx: Context) {
            const httpRequest: HTTPRequest = {
                body: event.body,
                headers: event.headers,
                method: event.requestContext.http.method as HttpMethod,
                url: event.rawPath,
                matchingKey: event.routeKey.split(" ")[1],
                params: event.pathParameters ?? {},
                rawQueryString: event.rawQueryString,
                requestId: ctx.awsRequestId,
                host: event.requestContext.domainName,
                moduleName: ctx.functionName.split("_")[0],
            };
            return [httpRequest];
        },
        createScheduleRequest: (event: ScheduledEvent, ctx: Context) => {
            const ndx = event.resources[0].lastIndexOf("/");
            const name = event.resources[0].substring(ndx + 1, event.resources[0].length);
            const scheduleRequest: ScheduleRequest = {
                name,
                requestId: ctx.awsRequestId,
                moduleName: ctx.functionName.split("_")[0],
            };
            return [scheduleRequest]
        },
        createEventRequest: (event: EventRecord, ctx: Context) => {
            if (isSQSRecord(event)) {
                const attributes = convertMessageAttributes(event.messageAttributes);
                // Derive queue URL from ARN: arn:aws:sqs:{region}:{accountId}:{queueName}
                const arnParts = event.eventSourceARN.split(':');
                const queueUrl = `https://sqs.${arnParts[3]}.amazonaws.com/${arnParts[4]}/${arnParts[5]}`;
                const eventRequest: EventRequest = {
                    body: event.body,
                    attributes: {
                        ...attributes,
                        messageId: event.messageId,
                        receiptHandle: event.receiptHandle,
                        queueUrl,
                    },
                    requestId: ctx.awsRequestId,
                    //SQS timestamps are in milliseconds
                    timestamp: new Date(parseInt(event.attributes.ApproximateFirstReceiveTimestamp)),
                    attempts: parseInt(event.attributes.ApproximateReceiveCount),
                    moduleName: ctx.functionName.split("_")[0],
                };
                return [eventRequest];
            } else if (isSNSRecord(event)) {
                const sns = event.Sns;

                // Convert SNS message attributes
                const attributes = convertMessageAttributes(sns.MessageAttributes);

                const eventRequest: EventRequest = {
                    body: sns.Message,
                    attributes: {
                        ...attributes,
                        messageId: sns.MessageId,
                        subject: sns.Subject ?? '',
                    },
                    requestId: ctx.awsRequestId,
                    // SNS timestamps are in ISO 8601 format
                    timestamp: new Date(sns.Timestamp),
                    // SNS doesn't have attempts concept like SQS, but we can set it to 1
                    attempts: 1,
                    moduleName: ctx.functionName.split("_")[0],
                };

                return [eventRequest];
            } else {
                throw new Error('Unsupported event type');
            }
        },
        createWebSocketRequest: (event: APIGatewayProxyEvent, ctx: Context, trigger: WebSocketTrigger) => {
            const connectionId = event.requestContext?.connectionId!;
            const routeKey = event.requestContext?.routeKey;
            const path = event.requestContext?.path || event.headers["x-original-path"];

            const params = extractParams(trigger.options.path || "", path || "") || {};

            // Map AWS route keys to WebSocket events
            let wsEvent: "connect" | "disconnect" | "message";
            let route: string | undefined;
            if (routeKey === "$connect") {
                wsEvent = "connect";
            } else if (routeKey === "$disconnect") {
                wsEvent = "disconnect";
            } else {
                wsEvent = "message";
                route = routeKey === "$default" ? undefined : routeKey;
            }

            const wsRequest: WebSocketRequest = {
                connectionId,
                event: wsEvent,
                route,
                url: path || "/",
                params: params,
                queryString: event.queryStringParameters,
                body: event.body || undefined,
                headers: event.headers,
                requestId: ctx.awsRequestId,
                moduleName: ctx.functionName.split("_")[0],
            };
            return [wsRequest];
        },
        createInvokeRequest: (event: { calledModule: string; invokeTriggerName: string; payload: any }, ctx: Context) => {
            const invokeRequest: InvokeRequest = {
                payload: event.payload,
                invokeTriggerName: event.invokeTriggerName,
                calledModule: event.calledModule,
                requestId: ctx.awsRequestId,
            };
            return [invokeRequest];
        },
        buildHttpResponse: (ctx: HttpFunctionContext) => {
            const response = ctx.response;
            if (500 <= response.status && response.status < 600) {
                throw response.body; // Log or handle server errors
            }
            return {
                statusCode: response.status,
                body: response.body,
                headers: response.headers,
            } as APIGatewayProxyResultV2;
        },
        buildScheduleResponse: () => {
            //TODO: Implement schedule response handling
            // const response = ctx.response;
            // return {
            //     statusCode: response.status,
            //     body: response.body,
            // };
            return undefined;
        },
        buildEventResponse: async (ctx: EventFunctionContext): Promise<EventBatchItemResult> => {
            const { messageId, receiptHandle, queueUrl } = ctx.attributes<{ messageId: string; receiptHandle: string; queueUrl: string }>();
            if (ctx.response.status === "error") {
                if (messageId) {
                    if (ctx.response.retryDelay !== undefined && receiptHandle && queueUrl) {
                        const sqsClient = new SQSClient({});
                        await sqsClient.send(new ChangeMessageVisibilityCommand({
                            QueueUrl: queueUrl,
                            ReceiptHandle: receiptHandle,
                            VisibilityTimeout: ctx.response.retryDelay,
                        }));
                    }
                    return { failureId: messageId };
                }
            }
            return undefined;
        },
        buildWebSocketResponse: (ctx: WebSocketFunctionContext) => {
            if (ctx.response.status === "error") {
                return {
                    statusCode: ctx.response.statusCode ?? 500,
                    body: JSON.stringify(ctx.response.body),
                };
            }
            return { statusCode: 200 };
        },
        buildInvokeResponse: (ctx: InvokeFunctionContext) => {
            return ctx.response.body;
        },
    }
}