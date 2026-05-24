import { InvokeFunctionContext } from "@cloudnux/core-cloud-provider";
import { logger } from "@cloudnux/utils";

import { cloudFunctions } from "../cloud-functions";
import { createInvokeContext } from "./create-invoke-context";

type InvokeHandler = (context: InvokeFunctionContext) => Promise<void> | void;

export async function invokeHandler(handler: InvokeHandler, ...args: any[]): Promise<any> {
    try {
        logger.debug({ args }, "Executing Invoke handler with args");
        const [invokeRequest] = cloudFunctions().createInvokeRequest(...args);
        logger.debug({ request: invokeRequest }, "Created Invoke request");
        const context = createInvokeContext(invokeRequest);
        await handler(context);
        logger.debug({ response: context.response }, "Invoke Handler executed successfully, building response");
        return cloudFunctions().buildInvokeResponse(context, ...args);
    }
    catch (error) {
        logger.error({ error }, "Error in Invoke handler");
        throw error;
    }
}
