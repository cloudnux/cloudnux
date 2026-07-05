import { IService } from "../cloud-container";

export interface LoggerService extends IService {
    level: string;
    setBindings(bindings: Record<string, string>): void;
    fatal(mergeObject: Record<string, any> | string, msg?: string): void;
    error(mergeObject: Record<string, any> | string, msg?: string): void;
    warn(mergeObject: Record<string, any> | string, msg?: string): void;
    info(mergeObject: Record<string, any> | string, msg?: string): void;
    debug(mergeObject: Record<string, any> | string, msg?: string): void;
    trace(mergeObject: Record<string, any> | string, msg?: string): void;
}

export type LogEntry = {
    level: number;
    levelName: string;
    time: number;
    module: string;
    reqId: string;
    msg: string;
    meta?: Record<string, unknown>;
};

//export type LogWriter = (entry: LogEntry) => void;
