import { APIGatewayProxyEvent, APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2, Context, ScheduledEvent, SQSRecord, SNSEventRecord, SQSBatchItemFailure } from "aws-lambda";
import {
    FunctionsService, HttpMethod,
    HTTPRequest, HTTPAuth, HttpFunctionContext,
    ScheduleRequest,
    EventRequest, EventFunctionContext,
    WebSocketRequest, WebSocketFunctionContext
} from "@cloudnux/core-cloud-provider";

import { tokenUtils } from "@cloudnux/utils"

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


export function createLocalFunctionsService(): FunctionsService {
    return {
        createHttRequest(event: APIGatewayProxyEventV2WithJWTAuthorizer, ctx: Context) {
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
            };
            let httpAuth: HTTPAuth | undefined = undefined;
            if (event.headers.Authorization || event.headers.authorization) {
                const header = event.headers.Authorization ?? event.headers.authorization;
                const token = header!.replace("bearer ", "").replace("Bearer ", "");
                const jwtClaims = tokenUtils.decodeAccessToken(token) as Record<string, string>;
                httpAuth = {
                    token: token,
                    claims: jwtClaims,
                    appId: jwtClaims["app_id"],
                    memberId: jwtClaims["member_id"],
                    customerId: jwtClaims["customer_id"],
                    identity: jwtClaims["identity"] as HTTPAuth["identity"],
                };
            }
            return [httpRequest, httpAuth];
        },
        createScheduleRequest: (event: ScheduledEvent, ctx: Context) => {
            const ndx = event.resources[0].lastIndexOf("/");
            const name = event.resources[0].substring(ndx + 1, event.resources[0].length);
            const scheduleRequest: ScheduleRequest = {
                name,
                requestId: ctx.awsRequestId,
            };
            return [scheduleRequest]
        },
        createEventRequest: (event: EventRecord, ctx: Context) => {
            if (isSQSRecord(event)) {
                const attributes = convertMessageAttributes(event.messageAttributes);
                const eventRequest: EventRequest = {
                    body: event.body,
                    attributes: {
                        ...attributes,
                        messageId: event.messageId,
                    },
                    requestId: ctx.awsRequestId,
                    //SQS timestamps are in milliseconds
                    timestamp: new Date(parseInt(event.attributes.ApproximateFirstReceiveTimestamp)),
                    attempts: parseInt(event.attributes.ApproximateReceiveCount),
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
                };

                return [eventRequest];
            } else {
                throw new Error('Unsupported event type');
            }
        },
        createWebSocketRequest: (event: APIGatewayProxyEvent, ctx: Context) => {
            const connectionId = event.requestContext?.connectionId!;
            const routeKey = event.requestContext?.routeKey;

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
                path: event.requestContext?.stage ?? "",
                route,
                body: event.body || undefined,
                headers: event.headers,
                // AWS doesn't have a native query string parsing for WebSocket events, so we can leave it empty or implement custom parsing if needed
                query: {},
                requestId: ctx.awsRequestId,
            };
            return [wsRequest];
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
        buildEventResponse: (ctx: EventFunctionContext) => {
            const messageId = ctx.attributes().messageId;
            if (ctx.response.status === "error") {
                if (messageId) {
                    // If messageId is present, we can return a failure response
                    return {
                        itemIdentifier: messageId,
                    } as SQSBatchItemFailure
                }
            }
            return undefined; // No failure response needed
        },
        buildWebSocketResponse: (ctx: WebSocketFunctionContext) => {
            if (ctx.response.status === "error") {
                return {
                    statusCode: 500,
                    body: JSON.stringify(ctx.response.body),
                };
            }
            return { statusCode: 200 };
        }
    }
}