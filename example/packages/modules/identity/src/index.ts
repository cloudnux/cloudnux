import { HttpFunctionContext, ErrorCode, ScheduleFunctionContext } from "@cloudnux/cloud-sdk";

export function getMe(ctx: HttpFunctionContext) {
    ctx.success({
        message: 'Hello from identity -> getMe'
    });
}

export function setMe(ctx: HttpFunctionContext) {
    console.info('getMe from identity -> setMe', ctx.params, ctx.request.body);

    ctx.error('Error from identity -> SetMe');
}

export function runSchedule(ctx: ScheduleFunctionContext) {
    console.info('Running scheduled task from identity -> runSchedule', ctx.request.name, ctx.request.requestId);

    ctx.success({
        message: 'Scheduled task completed successfully from identity -> runSchedule'
    });
}