import { HttpFunctionContext } from "@cloudnux/core-cloud-provider";
import { logger } from "@cloudnux/utils";

import { cloudFunctions } from "../cloud-functions";
import { createHttpContext } from "./create-http-context";

type HttpHandler = (context: HttpFunctionContext) => Promise<void> | void;

export async function httpHandler(handler: HttpHandler, ...args: any[]) {
    try {
        logger.debug({ args }, "Executing HTTP handler with args");
        const [httpRequest, httpAuth] = cloudFunctions().createHttRequest(...args);
        logger.debug({ httpRequest, httpAuth }, "Created HTTP request and auth");
        const context = createHttpContext(httpRequest, httpAuth);
        await handler(context);
        logger.debug({ response: context.response }, "Handler executed successfully, building HTTP response");
        return cloudFunctions().buildHttpResponse(context, ...args);
    }
    catch (error) {
        // Log the error and re-throw it for further handling
        logger.error({ error }, "Error in HTTP handler");
        throw error;
    }
}