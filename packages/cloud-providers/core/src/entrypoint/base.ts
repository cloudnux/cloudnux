export type HandlerType = "Http" | "Schedule" | "Event";

export type BaseEntry<TTrigger> = {
    handler: string,
    trigger: TTrigger
}