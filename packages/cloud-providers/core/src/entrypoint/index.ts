import { HttpEntry } from "./http";
import { ScheduleEntry } from "./schedule";
import { EventEntry } from "./event";
import { WebSocketEntry } from "./websocket";

export * from "./base";
export * from "./http";
export * from "./schedule";
export * from "./event";
export * from "./websocket";

export type Entry = HttpEntry | ScheduleEntry | EventEntry | WebSocketEntry
export type Entrypoint = {
    entries: Record<string, Entry>
}