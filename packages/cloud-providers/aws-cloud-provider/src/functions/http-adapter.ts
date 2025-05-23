import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2, Context } from "aws-lambda";
import { Adapter, HTTPRequest, HTTPAuth, HttpMethod } from "@@types";
import { createHttpContext } from "packages/sdk/src";

import { decode } from "../utils/token";

export const httpAdapter: Adapter = {
    input: (...args) => {
        const [_, event, ctx] = args as [any, APIGatewayProxyEventV2WithJWTAuthorizer, Context];
        let request: HTTPRequest = {
            body: event.body,
            headers: event.headers,
            method: event.requestContext.http.method as HttpMethod,
            url: event.rawPath,
            matchingKey: event.routeKey.split(" ")[1],
            params: event.pathParameters,
            rawQueryString: event.rawQueryString,
            requestId: ctx.awsRequestId,
            host: event.requestContext.domainName,
        };
        let auth: HTTPAuth = null;
        if (event.headers.Authorization || event.headers.authorization) {
            const header = event.headers.Authorization || event.headers.authorization;
            const token = header.replace("bearer ", "").replace("Bearer ", "");
            const jwtClaims = decode(token) as Record<string, string>;
            auth = {
                token: token,
                claims: jwtClaims,
                appId: jwtClaims["app_id"],
                memberId: jwtClaims["member_id"],
                customerId: jwtClaims["customer_id"],
                identity: jwtClaims["identity"] as HTTPAuth["identity"],
            };
        }
        return createHttpContext(request, auth);;
    },
    output: (response) => {
        if (500 <= response.status && response.status < 600) {
            throw response.body; // Log or handle server errors
        }
        return {
            statusCode: response.status,
            body: response.body,
            headers: response.headers,
        } as APIGatewayProxyResultV2;
    },
};