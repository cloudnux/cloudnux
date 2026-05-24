import { InvokeService } from "@cloudnux/core-cloud-provider";

import { getInvokeHandler } from "../invoke-plugin/registry";

export function createLocalInvokeService(): InvokeService {
    return {
        async invoke<TPayload, TResponse>(
            moduleName: string,
            triggerName: string,
            payload: TPayload
        ): Promise<TResponse> {
            const handler = getInvokeHandler(moduleName, triggerName);
            if (!handler) {
                throw new Error(`No local invoke handler registered for: ${moduleName}:${triggerName}`);
            }
            const envelope = {
                calledModule: moduleName,
                invokeTriggerName: triggerName,
                payload,
            };
            return await handler(envelope) as TResponse;
        }
    };
}
