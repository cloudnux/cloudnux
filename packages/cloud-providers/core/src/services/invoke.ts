import { IService } from "../cloud-container";
import type { InvokeResponse } from "./functions";

export interface InvokeService extends IService {
    /**
     * Invoke a function directly.
     * @param target - `module` to call a module of the caller's own namespace, or `namespace/module` to call another namespace.
     * @param triggerName - The invoke trigger name registered in the target function's entrypoint.
     * @param payload - The payload to pass to the invoked function.
     * @returns The data the invoked function passed to `context.success()`.
     * @throws {InvokeError} when the invoked function ended with `context.error()` / `notFound()` / `serverError()`.
     * A function that throws (or a transport failure) surfaces as a plain `Error`.
     */
    invoke<TPayload = any, TResponse = any>(
        target: string,
        triggerName: string,
        payload: TPayload
    ): Promise<TResponse>;
}

export type InvokeTarget = {
    /** undefined means the caller's own namespace */
    namespace?: string,
    module: string,
};

/**
 * Parse an invoke target: `module` (caller's own namespace) or `namespace/module`.
 * "/" is used as separator because namespaces and modules may both contain "_".
 */
export function parseInvokeTarget(target: string): InvokeTarget {
    const parts = target.split("/");
    if (parts.length > 2 || parts.some(p => !p)) {
        throw new Error(`Invalid invoke target "${target}", expected "module" or "namespace/module"`);
    }
    return parts.length === 2 ? { namespace: parts[0], module: parts[1] } : { module: parts[0] };
}

/**
 * Thrown by `invoke()` when the invoked function ended with an error response.
 * Carries the callee's `code` (an `ErrorCode` or a domain code) and `details`.
 */
export class InvokeError extends Error {
    readonly code?: string;
    readonly details?: Record<string, any>;
    readonly target: string;
    readonly triggerName: string;

    constructor(response: InvokeResponse, target: string, triggerName: string) {
        const message = typeof response.body === "string" && response.body
            ? response.body
            : `Invoke ${target}:${triggerName} failed`;
        super(message);
        this.name = "InvokeError";
        this.code = response.code;
        this.details = response.details;
        this.target = target;
        this.triggerName = triggerName;
    }
}

function isInvokeResponse(value: unknown): value is InvokeResponse {
    return !!value && typeof value === "object"
        && ((value as InvokeResponse).status === "success" || (value as InvokeResponse).status === "error");
}

/**
 * Turns an `InvokeResponse` into what the caller sees: the body on success,
 * a thrown `InvokeError` on error. Used by every provider's invoke client so
 * callers behave the same on AWS and locally.
 */
export function unwrapInvokeResponse<TResponse>(response: unknown, target: string, triggerName: string): TResponse {
    if (!isInvokeResponse(response)) {
        throw new Error(
            `Invoke ${target}:${triggerName} returned an unexpected response; ` +
            `caller and callee must both run a cloudnux version with the invoke response envelope`
        );
    }
    if (response.status === "error") {
        throw new InvokeError(response, target, triggerName);
    }
    return response.body as TResponse;
}
