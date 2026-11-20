import { IService } from "../cloud-container";

/**
 * Read-only access to secrets kept in the cloud's secret store
 * (aws: SSM Parameter Store or Secrets Manager, azure: Key Vault,
 * gcp: Secret Manager, local: the process environment).
 *
 * Typical use is a cold start hook that loads secrets into process.env
 * once per instance, so the application code stays cloud-agnostic.
 */
export interface SecretsService extends IService {
    /**
     * Read one secret
     * @param name Secret name as known to the store (e.g. an SSM parameter path)
     * @returns Promise resolving to the secret value
     * @throws SecretsNotFoundError if the secret does not exist
     */
    get(name: string): Promise<string>;

    /**
     * Read several secrets in as few requests as the store allows
     * @param names Secret names as known to the store
     * @returns Promise resolving to a map of name -> value
     * @throws SecretsNotFoundError listing every missing name, if any is missing
     */
    getMany(names: string[]): Promise<Record<string, string>>;
}

/**
 * Thrown when one or more requested secrets do not exist
 */
export class SecretsNotFoundError extends Error {
    readonly names: string[];

    /**
     * @param names Missing secret names
     * @param where Optional hint where they were looked up (e.g. a file path)
     */
    constructor(names: string[], where?: string) {
        super(`Secret${names.length === 1 ? "" : "s"} not found: ${names.join(", ")}${where ? ` (in ${where})` : ""}`);
        this.name = "SecretsNotFoundError";
        this.names = names;
    }
}
