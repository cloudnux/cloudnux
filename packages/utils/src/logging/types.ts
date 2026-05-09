export const logLevels = {
    fatal: -1,
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
};

export type Logger = {
    level: string;
    fatal: (mergeObject: Record<string, any> | string, msg?: string) => void;
    error: (mergeObject: Record<string, any> | string, msg?: string) => void;
    warn: (mergeObject: Record<string, any> | string, msg?: string) => void;
    info: (mergeObject: Record<string, any> | string, msg?: string) => void;
    debug: (mergeObject: Record<string, any> | string, msg?: string) => void;
    trace: (mergeObject: Record<string, any> | string, msg?: string) => void;
    silent: (mergeObject: Record<string, any> | string, msg?: string) => void;
    child: (bindings: Record<string, string>) => Logger;
}