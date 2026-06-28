import { EventFunctionContext, EventBatchItemResult } from "@cloudnux/core-cloud-provider";

import { cloudFunctions } from "../cloud-functions";
import { cloudLogger } from "../../logger";
import { createEventContext } from "./create-event-context";

type Handler = (context: EventFunctionContext) => Promise<void>;

export async function eventBrokerHandler(handler: Handler, ...args: any[]): Promise<EventBatchItemResult> {
    const log = cloudLogger();
    try {
        log.debug({ args }, "Executing Event Broker handler with args");
        const [eventRequest] = cloudFunctions().createEventRequest(...args);
        log.setBindings({ reqId: eventRequest.requestId ?? "", module: eventRequest.moduleName ?? "" });
        log.debug({
            request: eventRequest,
        }, "Created Event Broker request ");
        const context = createEventContext(eventRequest, log);
        await handler(context);
        log.debug({ response: context.response }, "Event Broker Handler executed successfully, building response");
        return await cloudFunctions().buildEventResponse(context);
    }
    catch (error) {
        // Log the error and re-throw it for further handling
        log.error({ error }, "Error in Event Broker handler");
        throw error;
    }
}