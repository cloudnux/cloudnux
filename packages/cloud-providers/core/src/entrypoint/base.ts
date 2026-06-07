export type HandlerType = "Http" | "Schedule" | "Event" | "WebSocket" | "Invoke";

export type BaseEntry<TTrigger> = {
    handler: string,
    trigger: TTrigger
}