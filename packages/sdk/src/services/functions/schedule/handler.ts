import { ScheduleFunctionContext } from "@cloudnux/core-cloud-provider";

import { cloudFunctions } from "../cloud-functions";
import { cloudLogger } from "../../logger";
import { createScheduleContext } from "./create-schedule-context";

type Handler = (context: ScheduleFunctionContext) => Promise<void> | void;

export async function scheduleHandler(handler: Handler, ...args: any[]) {
    const log = cloudLogger();
    try {
        log.debug({ args }, "Executing Schedule handler with args");
        const [scheduleRequest] = cloudFunctions().createScheduleRequest(...args);
        log.setBindings({ reqId: scheduleRequest.requestId ?? "", module: scheduleRequest.moduleName ?? "" });
        log.debug({
            request: scheduleRequest,
        }, "Created Schedule request ");
        const context = createScheduleContext(scheduleRequest, log);
        await handler(context);
        log.debug({ response: context.response }, "Schedule Handler executed successfully, building response");
        return cloudFunctions().buildScheduleResponse(context);
    }
    catch (error) {
        // Log the error and re-throw it for further handling
        log.error({ error }, "Error in Schedule handler");
        throw error;
    }
}