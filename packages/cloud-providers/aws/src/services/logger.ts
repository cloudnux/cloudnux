import { LoggerService } from "@cloudnux/core-cloud-provider";


export function createLoggerService(): LoggerService {
    const _bindings = {} as Record<string, string>;
    return {
        level: "info",
        setBindings: (bindings: Record<string, string>) => {
            Object.assign(_bindings, bindings);
        },
        // fatal: makeMethod("fatal"),
        // error: makeMethod("error"),
        // warn: makeMethod("warn"),
        // info: makeMethod("info"),
        // debug: makeMethod("debug"),
        // trace: makeMethod("trace"),
    };
}
