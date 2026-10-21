import { InvokeService, parseInvokeTarget } from "@cloudnux/core-cloud-provider";

import { InvokeManager } from "../invoke-plugin/types";

export type LocalInvokeConfig = {
    /** namespace of this dev server */
    namespace?: string,
    /** namespace -> base url of the dev server running it, from nux.config `namespaces` */
    namespaces?: Record<string, string>,
};

let _manager: InvokeManager | null = null;
let _config: LocalInvokeConfig = {};

export function setInvokeManager(manager: InvokeManager) {
    _manager = manager;
}

export function configureLocalInvoke(config: LocalInvokeConfig) {
    _config = config;
}

async function invokeRemote<TResponse>(
    namespace: string,
    module: string,
    triggerName: string,
    payload: unknown
): Promise<TResponse> {
    const baseUrl = _config.namespaces?.[namespace];
    if (!baseUrl) {
        throw new Error(`Namespace "${namespace}" has no url in the nux config "namespaces"`);
    }
    const url = `${baseUrl.replace(/\/+$/, "")}/__invoke/${encodeURIComponent(module)}/${encodeURIComponent(triggerName)}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload }),
    });
    const body = await response.json().catch(() => ({})) as { result?: TResponse, error?: string };
    if (!response.ok) {
        throw new Error(body.error ?? `Remote invoke ${namespace}/${module}:${triggerName} failed with status ${response.status}`);
    }
    return body.result as TResponse;
}

export function createLocalInvokeService(): InvokeService {
    return {
        async invoke<TPayload, TResponse>(
            target: string,
            triggerName: string,
            payload: TPayload
        ): Promise<TResponse> {
            const { namespace, module } = parseInvokeTarget(target);
            if (namespace && namespace !== _config.namespace) {
                return invokeRemote<TResponse>(namespace, module, triggerName, payload);
            }

            const handler = _manager!.get(module, triggerName);
            if (!handler) {
                throw new Error(`No local invoke handler registered for: ${module}:${triggerName}`);
            }
            const envelope = {
                calledModule: module,
                invokeTriggerName: triggerName,
                payload,
            };
            return await handler(envelope) as TResponse;
        }
    };
}
