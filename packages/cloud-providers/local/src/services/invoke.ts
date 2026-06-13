import { InvokeService } from "@cloudnux/core-cloud-provider";

import { InvokeManager } from "../invoke-plugin/types";

let _manager: InvokeManager | null = null;

export function setInvokeManager(manager: InvokeManager) {
    _manager = manager;
}

export function createLocalInvokeService(): InvokeService {
    return {
        async invoke<TPayload, TResponse>(
            moduleName: string,
            triggerName: string,
            payload: TPayload
        ): Promise<TResponse> {
            const handler = _manager!.get(moduleName, triggerName);
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
