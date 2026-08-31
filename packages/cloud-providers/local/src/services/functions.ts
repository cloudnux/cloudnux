import * as querystring from "querystring"

import "fastify-raw-body";
import { FastifyRequest, FastifyReply } from "fastify";

import { EventBatchItemResult, EventFunctionContext, EventRequest, FunctionsService, HttpFunctionContext, HttpMethod, HTTPRequest, InvokeFunctionContext, InvokeRequest, ScheduleFunctionContext, ScheduleRequest, WebSocketFunctionContext, WebSocketRequest } from "@cloudnux/core-cloud-provider";

import { QueueMessage } from "../queue-plugin/types";
import { ScheduledJob, JobExecution } from "../schedule-plugin/types";
import { WebSocketEvent } from "../websocket-plugin/types";


const getFullUrlFromRequest = (request: FastifyRequest) => {
    // Get protocol (http/https)
    const protocol = request.protocol;

    // Get hostname
    const hostname = request.hostname;

    // Get port (may be undefined if using standard ports 80/443)
    const port = request.raw.socket.localPort;

    // Build the host part with port if non-standard
    let hostWithPort = hostname;
    if (port &&
        !((protocol === 'http' && port === 80) ||
            (protocol === 'https' && port === 443))) {
        hostWithPort = `${hostname}:${port}`;
    }

    // Get the path including query parameters
    const url = request.url;

    // Construct the full URL
    return `${protocol}://${hostWithPort}${url}`;

}

export function createLocalFunctionsService(): FunctionsService {
    return {
        createHttRequest(request: FastifyRequest) {
            const rawBody = request.rawBody;
            const httpRequest: HTTPRequest = {
                body: String(rawBody),
                headers: request.headers,
                method: request.method as HttpMethod,
                url: getFullUrlFromRequest(request),
                matchingKey: request.routeOptions.url,
                params: request.params as Record<string, string>,
                rawQueryString: querystring.stringify(request.query as any),
                host: request.hostname,
                requestId: request.id,
                moduleName: (request.routeOptions.config as { module?: string } | undefined)?.module,
            };

            return [httpRequest];
        },
        createScheduleRequest: (job: ScheduledJob, execution: JobExecution) => {
            const scheduleName = job.name
            const scheduleRequest: ScheduleRequest = {
                name: scheduleName,
                requestId: execution.id,
                moduleName: job.module,
            }
            return [scheduleRequest]
        },
        createEventRequest: (message: QueueMessage) => {
            const eventRequest: EventRequest = {
                body: message.payload,
                attributes: {
                    ...message.attributes,
                    messageId: message.id,
                },
                requestId: message.id,
                timestamp: message.timestamp,
                attempts: message.attempts
            }
            return [eventRequest];
        },
        createWebSocketRequest: (connectionId: string, event: WebSocketEvent, data: any, request: FastifyRequest) => {
            const wsRequest: WebSocketRequest = {
                connectionId,
                event,
                url: getFullUrlFromRequest(request),
                params: request.params as Record<string, string>,
                body: data,
                queryString: request.query as Record<string, string>,
                headers: request.headers,
                requestId: request.id
            };
            return [wsRequest];
        },
        createInvokeRequest: (envelop: { payload?: any, calledModule: string, invokeTriggerName: string }, requestId?: string) => {
            const invokeRequest: InvokeRequest = {
                payload: envelop.payload,
                calledModule: envelop.calledModule,
                invokeTriggerName: envelop.invokeTriggerName,
                requestId,
            };
            return [invokeRequest];
        },

        buildHttpResponse: (context: HttpFunctionContext, _: FastifyRequest, reply: FastifyReply) => {
            reply
                .headers(context.response.headers ?? {})
                .status(context.response.status)
                .send(context.response.body);
        },
        buildScheduleResponse: (context: ScheduleFunctionContext) => {
            if (context.response.status === "error") {
                throw new Error(JSON.stringify(context.response.body));
            }
            return context.response.body;
        },
        buildEventResponse: async (context: EventFunctionContext): Promise<EventBatchItemResult> => {
            if (context.response.status === "error") {
                const { messageId } = context.attributes<{ messageId: string }>();
                return { failureId: messageId };
            }
            return undefined;
        },
        buildWebSocketResponse: (context: WebSocketFunctionContext, _, __, ___, ____, reply: FastifyReply) => {
            if (context.response.status === "error") {
                if (reply) {
                    return reply
                        .status(context.response.statusCode ?? 500)
                        .send(context.response.body);
                }
                return undefined;
            }
            return undefined;
        },
        buildInvokeResponse: (context: InvokeFunctionContext) => {
            if (context.response.status === "error") {
                throw new Error(JSON.stringify(context.response.body));
            }
            return context.response.body;
        },
    }
}