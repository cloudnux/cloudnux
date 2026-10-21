import { IService } from "../cloud-container";

export interface InvokeService extends IService {
    /**
     * Invoke a function directly.
     * @param target - `module` to call a module of the caller's own namespace, or `namespace/module` to call another namespace.
     * @param triggerName - The invoke trigger name registered in the target function's entrypoint.
     * @param payload - The payload to pass to the invoked function.
     * @returns The response body returned by the invoked function.
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
