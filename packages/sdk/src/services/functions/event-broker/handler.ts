import { EventFunctionContext, EventBatchItemResult } from "@cloudnux/core-cloud-provider";
import { logger } from "@cloudnux/utils";

import { cloudFunctions } from "../cloud-functions";
import { createEventContext } from "./create-event-context";

type Handler = (context: EventFunctionContext) => Promise<void>;

export async function eventBrokerHandler(handler: Handler, ...args: any[]): Promise<EventBatchItemResult> {
    try {
        logger.debug({ args }, "Executing Event Broker handler with args");
        const [eventRequest] = cloudFunctions().createEventRequest(...args);
        logger.debug({
            request: eventRequest,
        }, "Created Event Broker request ");
        const context = createEventContext(eventRequest);
        await handler(context);
        logger.debug({ response: context.response }, "Event Broker Handler executed successfully, building response");
        return await cloudFunctions().buildEventResponse(context);
    }
    catch (error) {
        // Log the error and re-throw it for further handling
        logger.error({ error }, "Error in Event Broker handler");
        throw error;
    }
}