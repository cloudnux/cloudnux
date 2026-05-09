import { EOL } from "os";

export type LogEntry = {
    level: number;
    levelName: string;
    time: number;
    module: string;
    reqId: string;
    msg: string;
    meta?: Record<string, unknown>;
};

export type LogWriter = (entry: LogEntry) => void;

const jsonWriter: LogWriter = (entry) => {
    process.stdout.write(JSON.stringify(entry) + EOL);
};

let _writer: LogWriter = jsonWriter;

export function setWriter(writer: LogWriter): void {
    _writer = writer;
}

export function getWriter(): LogWriter {
    return _writer;
}
