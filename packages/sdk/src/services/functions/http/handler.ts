import { HttpFunctionContext } from "@cloudnux/core-cloud-provider";

import { cloudFunctions } from "../cloud-functions";
import { cloudLogger } from "../../logger";
import { createHttpContext } from "./create-http-context";

type HttpHandler = (context: HttpFunctionContext) => Promise<void> | void;

export async function httpHandler(handler: HttpHandler, ...args: any[]) {
    const log = cloudLogger();
    try {
        log.debug({ args }, "Executing HTTP handler with args");
        const [httpRequest, httpAuth] = cloudFunctions().createHttRequest(...args);
        log.setBindings({ reqId: httpRequest.requestId ?? "", module: httpRequest.moduleName ?? "" });
        log.debug({ httpRequest, httpAuth }, "Created HTTP request and auth");
        const context = createHttpContext(httpRequest, httpAuth, log);
        await handler(context);
        log.debug({ response: context.response }, "Handler executed successfully, building HTTP response");
        return cloudFunctions().buildHttpResponse(context, ...args);
    }
    catch (error) {
        // Log the error and re-throw it for further handling
        log.error({ error }, "Error in HTTP handler");
        throw error;
    }
}