import { InvokeHandlerFn } from "./types";

const registry = new Map<string, InvokeHandlerFn>();

export function registerInvokeHandler(module: string, name: string, handler: InvokeHandlerFn): void {
    const key = `${module}:${name}`;
    registry.set(key, handler);

}

export function getInvokeHandler(module: string, name: string): InvokeHandlerFn | undefined {
    const key = `${module}:${name}`;
    return registry.get(key);
}

export function listInvokeHandlers(): string[] {
    return Array.from(registry.keys());
}
