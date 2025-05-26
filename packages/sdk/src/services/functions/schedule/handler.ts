import { ScheduleFunctionContext } from "@cloudnux/core-cloud-provider";
import { logger } from "@cloudnux/utils";

import { cloudFunctions } from "../cloud-functions";
import { createScheduleContext } from "./create-schedule-context";

type Handler = (context: ScheduleFunctionContext) => Promise<void>;

export async function scheduleHandler(handler: Handler, ...args: any[]) {
    try {
        logger.debug("Executing Schedule handler with args", { args });
        const [scheduleRequest] = cloudFunctions.createScheduleRequest(...args);
        logger.debug("Created Schedule request ", {
            request: scheduleRequest,
        });
        const context = createScheduleContext(scheduleRequest);
        await handler(context);
        logger.debug("Schedule Handler executed successfully, building response", { response: context.response });
        return cloudFunctions.buildScheduleResponse(context);
    }
    catch (error) {
        // Log the error and re-throw it for further handling
        logger.error("Error in Schedule handler", { error });
        throw error;
    }
}