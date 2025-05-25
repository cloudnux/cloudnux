import { BaseEntry } from "./base"

export type ScheduleTrigger = {
    type: "schedule",
    options: {
        pattern: string
    }
}

export type ScheduleEntry = BaseEntry<ScheduleTrigger>
