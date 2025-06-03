import { BaseEntry } from "./base"

export type ScheduleTrigger = {
    type: "schedule",
    options: {
        name: string,
        pattern: string
    }
}

export type ScheduleEntry = BaseEntry<ScheduleTrigger>
