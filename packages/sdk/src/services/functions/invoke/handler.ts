import { InvokeFunctionContext } from "@cloudnux/core-cloud-provider";

import { cloudFunctions } from "../cloud-functions";
import { cloudLogger } from "../../logger";
import { createInvokeContext } from "./create-invoke-context";

type InvokeHandler = (context: InvokeFunctionContext) => Promise<void> | void;

export async function invokeHandler(handler: InvokeHandler, ...args: any[]): Promise<any> {
    const log = cloudLogger();
    try {
        log.debug({ args }, "Executing Invoke handler with args");
        const [invokeRequest] = cloudFunctions().createInvokeRequest(...args);
        log.setBindings({ reqId: invokeRequest.requestId ?? "", module: invokeRequest.calledModule ?? "" });
        log.debug({ request: invokeRequest }, "Created Invoke request");
        const context = createInvokeContext(invokeRequest, log);
        await handler(context);
        log.debug({ response: context.response }, "Invoke Handler executed successfully, building response");
        return cloudFunctions().buildInvokeResponse(context, ...args);
    }
    catch (error) {
        log.error({ error }, "Error in Invoke handler");
        throw error;
    }
}
