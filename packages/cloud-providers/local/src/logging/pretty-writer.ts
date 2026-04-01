import chalk from "chalk";
import { EOL } from "os";
import { setWriter } from "@cloudnux/utils";
import type { LogWriter, LogEntry } from "@cloudnux/utils";

const levelColor: Record<string, (s: string) => string> = {
    fatal: chalk.bgRed.white,
    error: chalk.red,
    warn: chalk.yellow,
    info: chalk.cyan,
    debug: chalk.gray,
    trace: chalk.white,
};

function formatTime(ms: number): string {
    return new Date(ms).toTimeString().slice(0, 8);
}

function formatMeta(meta: Record<string, unknown>): string {
    const { req, res, ...rest } = meta as any;
    const lines: string[] = [];

    if (req) {
        const reqParts = [`${req.method} ${req.url}`];
        if (req.remoteAddress) reqParts.push(`from ${req.remoteAddress}:${req.remotePort ?? ""}`);
        if (req.headers) reqParts.push(`headers=${JSON.stringify(req.headers, null, 2)}`);
        if (req.body !== undefined) reqParts.push(`body=${typeof req.body === "string" ? req.body : JSON.stringify(req.body, null, 2)}`);
        lines.push(chalk.dim("  req: " + reqParts.join(" ")));
    }
    if (res) {
        const resParts = [`${res.statusCode}`];
        if (res.headers) resParts.push(`headers=${JSON.stringify(res.headers, null, 2)}`);
        if (res.body !== undefined) resParts.push(`body=${typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2)}`);
        lines.push(chalk.dim("  res: " + resParts.join(" ")));
    }
    if (Object.keys(rest).length) {
        lines.push(chalk.dim("  " + JSON.stringify(rest, null, 2)));
    }

    return lines.length ? EOL + lines.join(EOL) : "";
}

const prettyWriter: LogWriter = (entry: LogEntry) => {
    const color = levelColor[entry.levelName] ?? chalk.white;
    const time = chalk.dim(formatTime(entry.time));
    const level = color(entry.levelName.toUpperCase().padEnd(5));
    const module = chalk.magenta(entry.module);
    const reqId = entry.reqId ? chalk.dim(`[${entry.reqId}]`) + " " : "";
    const meta = entry.meta ? formatMeta(entry.meta) : "";

    process.stdout.write(`${time} ${level} ${module} ${reqId}- ${entry.msg}${meta}${EOL}`);
};

setWriter(prettyWriter);
