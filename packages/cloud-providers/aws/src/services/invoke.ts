import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

import { InvokeService, parseInvokeTarget, unwrapInvokeResponse } from "@cloudnux/core-cloud-provider";

let _currentModule: string | undefined;

/**
 * Set by the generated entrypoint with the module this lambda was built from.
 * The lambda is named `<namespace>_<module>`, so knowing the module is what
 * lets us recover the caller's own namespace from AWS_LAMBDA_FUNCTION_NAME.
 */
export function setCurrentModule(moduleName: string) {
    _currentModule = moduleName;
}

export function resolveOwnNamespace(functionName = process.env.AWS_LAMBDA_FUNCTION_NAME): string {
    const suffix = _currentModule ? `_${_currentModule}` : undefined;
    if (!functionName || !suffix || !functionName.endsWith(suffix) || functionName.length === suffix.length) {
        throw new Error(
            `Cannot resolve the current namespace from lambda name "${functionName}" and module "${_currentModule}"; ` +
            `use "namespace/module" as the invoke target`
        );
    }
    return functionName.slice(0, -suffix.length);
}

export function createInvokeService(): InvokeService {
    const lambdaClient = new LambdaClient({});

    return {
        async invoke<TPayload, TResponse>(
            target: string,
            triggerName: string,
            payload: TPayload
        ): Promise<TResponse> {
            const { namespace, module } = parseInvokeTarget(target);
            const envelope = {
                calledModule: module,
                invokeTriggerName: triggerName,
                payload,
            };

            const command = new InvokeCommand({
                FunctionName: `${namespace ?? resolveOwnNamespace()}_${module}`,
                Payload: Buffer.from(JSON.stringify(envelope)),
            });

            const response = await lambdaClient.send(command);
            const raw = response.Payload ? Buffer.from(response.Payload).toString() : "";

            if (response.FunctionError) {
                // the callee threw — Payload holds { errorMessage, errorType }
                let detail = response.FunctionError;
                try { detail = JSON.parse(raw).errorMessage ?? detail; } catch { /* keep FunctionError */ }
                throw new Error(`Lambda invocation error (${target}:${triggerName}): ${detail}`);
            }

            return unwrapInvokeResponse<TResponse>(raw ? JSON.parse(raw) : undefined, target, triggerName);
        }
    };
}
