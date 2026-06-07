import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

import { InvokeService } from "@cloudnux/core-cloud-provider";

export function createInvokeService(): InvokeService {
    const lambdaClient = new LambdaClient({});

    return {
        async invoke<TPayload, TResponse>(
            moduleName: string,
            triggerName: string,
            payload: TPayload
        ): Promise<TResponse> {
            const envelope = {
                calledModule: moduleName,
                invokeTriggerName: triggerName,
                payload,
            };

            const command = new InvokeCommand({
                FunctionName: moduleName,
                Payload: Buffer.from(JSON.stringify(envelope)),
            });

            const response = await lambdaClient.send(command);

            if (response.FunctionError) {
                throw new Error(`Lambda invocation error: ${response.FunctionError}`);
            }

            if (response.Payload) {
                return JSON.parse(Buffer.from(response.Payload).toString()) as TResponse;
            }

            return undefined as TResponse;
        }
    };
}
