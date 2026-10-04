import { HttpFunctionContext } from "@cloudnux/core-cloud-provider";

import { cloudFunctions } from "../cloud-functions";
import { cloudLogger } from "../../logger";
import { createHttpContext } from "./create-http-context";
import { HttpHalt } from "./halt";

type HttpHandler = (context: HttpFunctionContext) => Promise<void> | void;

export async function httpHandler(handler: HttpHandler, ...args: any[]) {
    const log = cloudLogger();
    const [httpRequest] = cloudFunctions().createHttRequest(...args);
    log.setBindings({ reqId: httpRequest.requestId ?? "", module: httpRequest.moduleName ?? "" });
    log.debug({ httpRequest }, "Created HTTP request");
    const context = createHttpContext(httpRequest, log);
    try {
        log.debug({ args }, "Executing HTTP handler with args");
        await handler(context);
        log.debug({ response: context.response }, "Handler executed successfully, building HTTP response");
        return cloudFunctions().buildHttpResponse(context, ...args);
    }
    catch (error) {
        if (error instanceof HttpHalt) {
            log.debug({ response: context.response }, "Handler chain halted, building HTTP response");
            return cloudFunctions().buildHttpResponse(context, ...args);
        }
        // Log the error and re-throw it for further handling
        log.error({ error }, "Error in HTTP handler");
        throw error;
    }
}