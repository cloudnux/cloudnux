import { HttpFunctionContext, EventFunctionContext, cloudEventBroker } from "@cloudnux/cloud-sdk";

export function token() {

}

export function revoke() {

}

export async function publishDelayed(ctx: HttpFunctionContext) {
    const { delaySeconds = 10, message = "Hello with a delay" } = ctx.model<{ delaySeconds?: number; message?: string }>();
    const sentAt = new Date().toISOString();

    await cloudEventBroker().publish("queues/delay-test", { message, sentAt }, { delaySeconds: Number(delaySeconds) });

    ctx.success({
        queue: "delay-test",
        delaySeconds: Number(delaySeconds),
        sentAt,
        expectedProcessingAt: new Date(Date.now() + Number(delaySeconds) * 1000).toISOString()
    });
}

export async function handleDelayedMessage(ctx: EventFunctionContext) {
    const { message, sentAt } = ctx.message<{ message: string; sentAt: string }>();
    console.log(`[delay-test] sentAt=${sentAt} receivedAt=${new Date().toISOString()} message="${message}"`);
    ctx.success({});
}