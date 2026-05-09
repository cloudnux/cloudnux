import { ScheduleFunctionContext } from "@cloudnux/core-cloud-provider";
import { logger } from "@cloudnux/utils";

import { cloudFunctions } from "../cloud-functions";
import { createScheduleContext } from "./create-schedule-context";

type Handler = (context: ScheduleFunctionContext) => Promise<void> | void;

export async function scheduleHandler(handler: Handler, ...args: any[]) {
    try {
        logger.debug({ args }, "Executing Schedule handler with args");
        const [scheduleRequest] = cloudFunctions().createScheduleRequest(...args);
        logger.debug({
            request: scheduleRequest,
        }, "Created Schedule request ");
        const context = createScheduleContext(scheduleRequest);
        await handler(context);
        logger.debug({ response: context.response }, "Schedule Handler executed successfully, building response");
        return cloudFunctions().buildScheduleResponse(context);
    }
    catch (error) {
        // Log the error and re-throw it for further handling
        logger.error({ error }, "Error in Schedule handler");
        throw error;
    }
}