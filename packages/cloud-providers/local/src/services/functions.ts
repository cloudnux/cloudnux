import * as querystring from "querystring"

import "fastify-raw-body";
import { FastifyRequest, FastifyReply } from "fastify";

import { env, tokenUtils } from "@cloudnux/utils";
import { EventFunctionContext, EventRequest, FunctionsService, HTTPAuth, HttpFunctionContext, HttpMethod, HTTPRequest, ScheduleRequest } from "@cloudnux/core-cloud-provider";

import { QueueMessage } from "../queue-plugin/types";
import { ScheduledJob, JobExecution } from "../schedule-plugin/types";


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
            const isAuth = env("DEV_IDENTITY")

            const index = request.raw.rawHeaders ? request.raw.rawHeaders?.indexOf('Authorization') : -1;
            const authorization = index !== -1 ? request.raw.rawHeaders[index + 1] : null;

            // Remove "bearer" prefix and trim whitespace
            const token = authorization ? authorization.replace(/^bearer\s+/i, '') : null;
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
            };

            const jwtClaims = token && tokenUtils.decodeAccessToken(token) as Record<string, string>;
            const httpAuth: HTTPAuth | undefined = isAuth ? {
                appId: env("DEV_APP_ID"),
                memberId: env("DEV_MEMBER_ID"),
                customerId: env("DEV_CUSTOMER_ID"),
                identity: env("DEV_IDENTITY") as HTTPAuth["identity"],
                token: token ?? "",
                claims: {
                    app_id: env("DEV_APP_ID"),
                    member_id: env("DEV_MEMBER_ID"),
                    customer_id: env("DEV_CUSTOMER_ID"),
                    identity: env("DEV_IDENTITY", "facebook" as const)
                }
            } : jwtClaims ? {
                token: token,
                claims: jwtClaims,
                appId: jwtClaims.app_id,
                memberId: jwtClaims.member_id,
                customerId: jwtClaims.customer_id,
                identity: jwtClaims.identity as HTTPAuth["identity"]
            } : undefined;

            return [httpRequest, httpAuth];
        },
        createScheduleRequest: (job: ScheduledJob, execution: JobExecution) => {
            const scheduleName = job.name
            const scheduleRequest: ScheduleRequest = {
                name: scheduleName,
                requestId: execution.id
            }
            return [scheduleRequest]
        },
        createEventRequest: (message: QueueMessage) => {

            const eventRequest: EventRequest = {
                body: message.payload,
                attributes: message.attributes,
                requestId: message.id,
                timestamp: message.timestamp,
                attempts: message.attempts
            }
            return [eventRequest];
        },

        buildHttpResponse: (ctx: HttpFunctionContext, reply: FastifyReply) => {
            reply
                .headers(ctx.response.headers ?? {})
                .status(ctx.response.status)
                .send(ctx.response.body);
        },
        buildScheduleResponse: (_, reply: FastifyReply) => {
            reply
                .status(200)
                .send("success");
        },
        buildEventResponse: (context: EventFunctionContext) => {
            if (context.response.status === "error") {
                throw new Error(JSON.stringify(context.response.body));
            }
        }
    }

}