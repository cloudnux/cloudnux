import { HttpEntry } from "./http";
import { ScheduleEntry } from "./schedule";
import { EventEntry } from "./event";

export * from "./base";
export * from "./http";
export * from "./schedule";
export * from "./event";

export type Entry = HttpEntry | ScheduleEntry | EventEntry
export type Entrypoint = {
    entries: Record<string, Entry>
}