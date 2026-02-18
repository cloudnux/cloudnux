export type HandlerType = "Http" | "Schedule" | "Event" | "WebSocket";

export type BaseEntry<TTrigger> = {
    handler: string,
    trigger: TTrigger
}