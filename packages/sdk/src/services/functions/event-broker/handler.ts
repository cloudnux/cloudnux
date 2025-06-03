import { EventFunctionContext } from "@cloudnux/core-cloud-provider";
import { logger } from "@cloudnux/utils";

import { cloudFunctions } from "../cloud-functions";
import { createEventContext } from "./create-event-context";

type Handler = (context: EventFunctionContext) => Promise<void>;

export async function eventBrokerHandler(handler: Handler, ...args: any[]) {
    try {
        logger.debug("Executing Event Broker handler with args", { args });
        const [eventRequest] = cloudFunctions().createEventRequest(...args);
        logger.debug("Created Event Broker request ", {
            request: eventRequest,
        });
        const context = createEventContext(eventRequest);
        await handler(context);
        logger.debug("Event Broker Handler executed successfully, building response", { response: context.response });
        return cloudFunctions().buildEventResponse(context);
    }
    catch (error) {
        // Log the error and re-throw it for further handling
        logger.error("Error in Event Broker handler", { error });
        throw error;
    }
}