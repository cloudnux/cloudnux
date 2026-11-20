import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, BatchGetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

import { SecretsNotFoundError, SecretsService } from '@cloudnux/core-cloud-provider';

/**
 * Environment variable choosing the secret store of a function.
 * Set it per Lambda function (e.g. in Terraform):
 *   - "ssm" (default): SSM Parameter Store, names are parameter names/paths,
 *     SecureString values are decrypted
 *   - "secrets-manager": AWS Secrets Manager, names are secret names or ARNs
 */
export const SECRETS_STORE_ENV = 'CLOUDNUX_SECRETS_STORE';

export type AwsSecretsStore = 'ssm' | 'secrets-manager';

/** GetParameters accepts at most 10 names per call */
const SSM_BATCH_SIZE = 10;
/** BatchGetSecretValue accepts at most 20 secret ids per call */
const SECRETS_MANAGER_BATCH_SIZE = 20;

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

/**
 * Read the store configured for this function
 */
export function resolveSecretsStore(value = process.env[SECRETS_STORE_ENV]): AwsSecretsStore {
    if (!value || value === 'ssm') return 'ssm';
    if (value === 'secrets-manager') return 'secrets-manager';
    throw new Error(`${SECRETS_STORE_ENV} must be "ssm" or "secrets-manager", got "${value}"`);
}

/**
 * SSM Parameter Store: GetParameters in batches of 10, with decryption
 */
async function readFromSsm(client: SSMClient, names: string[]): Promise<{ values: Record<string, string>; missing: string[] }> {
    const values: Record<string, string> = {};
    const missing: string[] = [];

    for (const batch of chunk(names, SSM_BATCH_SIZE)) {
        const result = await client.send(new GetParametersCommand({ Names: batch, WithDecryption: true }));
        for (const parameter of result.Parameters ?? []) {
            if (parameter.Name !== undefined && parameter.Value !== undefined) {
                values[parameter.Name] = parameter.Value;
            }
        }
        missing.push(...(result.InvalidParameters ?? []));
    }

    return { values, missing };
}

/**
 * Secrets Manager: BatchGetSecretValue in batches of 20.
 * Values are returned under the name they were requested with (name or ARN).
 */
async function readFromSecretsManager(client: SecretsManagerClient, names: string[]): Promise<{ values: Record<string, string>; missing: string[] }> {
    const values: Record<string, string> = {};
    const missing: string[] = [];

    for (const batch of chunk(names, SECRETS_MANAGER_BATCH_SIZE)) {
        const result = await client.send(new BatchGetSecretValueCommand({ SecretIdList: batch }));

        const byKey = new Map<string, string>();
        for (const secret of result.SecretValues ?? []) {
            const value = secret.SecretString
                ?? (secret.SecretBinary ? Buffer.from(secret.SecretBinary).toString('utf8') : undefined);
            if (value === undefined) continue;
            if (secret.Name) byKey.set(secret.Name, value);
            if (secret.ARN) byKey.set(secret.ARN, value);
        }

        for (const name of batch) {
            const value = byKey.get(name);
            if (value !== undefined) {
                values[name] = value;
            }
        }

        for (const error of result.Errors ?? []) {
            if (error.ErrorCode && error.ErrorCode !== 'ResourceNotFoundException') {
                throw new Error(`Secrets Manager could not read "${error.SecretId}": ${error.ErrorCode} ${error.Message ?? ''}`.trim());
            }
        }
        missing.push(...batch.filter(name => values[name] === undefined));
    }

    return { values, missing };
}

/**
 * Create the AWS secrets service. The store (SSM or Secrets Manager) is chosen
 * per function with CLOUDNUX_SECRETS_STORE; values are cached for the lifetime
 * of the instance.
 * @returns AWS secrets service implementation
 */
export function createSecretsService(): SecretsService {
    const store = resolveSecretsStore();
    const cache = new Map<string, string>();

    let ssmClient: SSMClient | undefined;
    let secretsManagerClient: SecretsManagerClient | undefined;

    async function load(names: string[]): Promise<Record<string, string>> {
        const unique = [...new Set(names)];
        const toFetch = unique.filter(name => !cache.has(name));

        if (toFetch.length > 0) {
            const { values, missing } = store === 'ssm'
                ? await readFromSsm(ssmClient ??= new SSMClient(), toFetch)
                : await readFromSecretsManager(secretsManagerClient ??= new SecretsManagerClient(), toFetch);

            if (missing.length > 0) {
                throw new SecretsNotFoundError(missing);
            }
            for (const [name, value] of Object.entries(values)) {
                cache.set(name, value);
            }
        }

        return Object.fromEntries(unique.map(name => [name, cache.get(name)!]));
    }

    return {
        async get(name: string): Promise<string> {
            const values = await load([name]);
            return values[name];
        },

        async getMany(names: string[]): Promise<Record<string, string>> {
            if (names.length === 0) return {};
            return load(names);
        },
    };
}
