import { HttpFunctionContext } from "@cloudnux/core-cloud-provider";
import { logger } from "@cloudnux/utils";

import { cloudFunctions } from "../cloud-functions";
import { createHttpContext } from "./create-http-context";

type HttpHandler = (context: HttpFunctionContext) => Promise<void>;

export async function httpHandler(handler: HttpHandler, ...args: any[]) {
    try {
        logger.debug("Executing HTTP handler with args", { args });
        const [httpRequest, httpAuth] = cloudFunctions.createHttRequest(...args);
        logger.debug("Created HTTP request and auth", {
            request: httpRequest,
            auth: httpAuth
        });
        const context = createHttpContext(httpRequest, httpAuth);
        await handler(context);
        logger.debug("Handler executed successfully, building HTTP response", { response: context.response });
        return cloudFunctions.buildHttpResponse(context);
    }
    catch (error) {
        // Log the error and re-throw it for further handling
        logger.error("Error in HTTP handler", { error });
        throw error;
    }
}