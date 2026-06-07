import { BaseEntry } from "./base";

export type InvokeTrigger = {
    type: "invoke",
    options: {
        name: string,
    }
}

export type InvokeEntry = BaseEntry<InvokeTrigger>
