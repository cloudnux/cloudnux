import { HttpEntry } from "./http";
import { ScheduleEntry } from "./schedule";
import { EventEntry } from "./event";
import { WebSocketEntry } from "./websocket";
import { InvokeEntry } from "./invoke";

export * from "./base";
export * from "./http";
export * from "./schedule";
export * from "./event";
export * from "./websocket";
export * from "./invoke";

export type Entry = HttpEntry | ScheduleEntry | EventEntry | WebSocketEntry | InvokeEntry
export type Entrypoint = {
    entries: Record<string, Entry>
}