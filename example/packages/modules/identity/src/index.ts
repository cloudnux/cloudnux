import { HttpFunctionContext, ScheduleFunctionContext, WebSocketFunctionContext, ErrorCode, cloudWebSocket } from "@cloudnux/cloud-sdk";

let connectionId: string | null = null;
export function getMe(ctx: HttpFunctionContext) {
    ctx.error('user not found', ErrorCode.RESOURCE_NOT_FOUND, {
        message: 'User not found',
        data: ctx.params()
    });
}

export function setMe(ctx: HttpFunctionContext) {
    console.info('getMe from identity -> setMe', ctx.params(), ctx.request.body);
    const body = JSON.parse(ctx.request.body);
    ctx.success({
        message: 'Identity updated successfully from identity -> setMe',
        data: body
    });
}

export function runEvent(ctx: ScheduleFunctionContext) {
    ctx.success({});
}

export async function runSchedule(ctx: ScheduleFunctionContext) {
    console.info('Running scheduled task from identity -> runSchedule', ctx.request.name, ctx.request.requestId);
    if (connectionId) {
        await cloudWebSocket().sendToClient(connectionId, `Hello from  the other side , schedule style `);
    }
    ctx.success({
        message: 'Scheduled task completed successfully from identity -> runSchedule'
    });
}

export function runScheduledTask(ctx: ScheduleFunctionContext) {
    console.info('Running scheduled task from identity -> runScheduledTask', ctx.request.name, ctx.request.requestId);
    ctx.success({
        message: 'Scheduled task completed successfully from identity -> runScheduledTask'
    });
}

export function handleWebSocketConnect(ctx: WebSocketFunctionContext) {
    console.log('Received WebSocket message from identity -> handleWebSocketConnect');
    connectionId = ctx.connectionId;
    ctx.success({});
}

export async function handleWebSocketMessage(ctx: WebSocketFunctionContext) {
    const hello = ctx.message();
    console.log('Received WebSocket message from identity -> handleWebSocketMessage', hello);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await cloudWebSocket().sendToClient(ctx.connectionId, `Hello from  the other side `);
    ctx.success(hello);
}

export function handleWebSocketDisconnect(ctx: WebSocketFunctionContext) {
    console.log('Received WebSocket message from identity -> handleWebSocketDisconnect');
    connectionId = null;
    ctx.success({});
}