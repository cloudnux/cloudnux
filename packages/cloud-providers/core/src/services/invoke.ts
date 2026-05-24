export interface InvokeService {
    /**
     * Invoke a function directly.
     * @param moduleName - The name of the module containing the function to invoke.
     * @param triggerName - The invoke trigger name registered in the target function's entrypoint.
     * @param payload - The payload to pass to the invoked function.
     * @returns The response body returned by the invoked function.
     */
    invoke<TPayload = any, TResponse = any>(
        moduleName: string,
        triggerName: string,
        payload: TPayload
    ): Promise<TResponse>;
}
