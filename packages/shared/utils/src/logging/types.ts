export const logLevels = {
    fatal: -1,
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

export type Logger = {
    fatal: (message: string, meta?: Record<string, any>) => void;
    error: (message: string, meta?: Record<string, any>) => void;
    warn: (message: string, meta?: Record<string, any>) => void;
    info: (message: string, meta?: Record<string, any>) => void;
    debug: (message: string, meta?: Record<string, any>) => void;
}