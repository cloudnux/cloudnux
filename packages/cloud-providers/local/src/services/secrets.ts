import * as fs from "fs";

import { SecretsNotFoundError, SecretsService } from "@cloudnux/core-cloud-provider";

/**
 * Absolute path of the local secrets file. Set by the generated dev server from
 * `environments.develop.secretsFile` in nux.config (default "./.secrets.json",
 * next to .env) - not meant to be set by hand.
 */
export const SECRETS_FILE_ENV = "DEV_CLOUD_SECRETS_FILE";

function readSecretsFile(file: string): Record<string, string> {
    let raw: string;
    try {
        raw = fs.readFileSync(file, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
        throw error;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error(`Local secrets file is not valid JSON: ${file} (${(error as Error).message})`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`Local secrets file must contain a JSON object of name -> value: ${file}`);
    }

    const values: Record<string, string> = {};
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string") values[name] = value;
        else if (typeof value === "number" || typeof value === "boolean") values[name] = String(value);
        else throw new Error(`Local secret "${name}" must be a string in ${file}`);
    }
    return values;
}

/**
 * Local secrets service: the dev server's stand-in for SSM / Secrets Manager.
 *
 * Secrets live in a JSON file next to .env (environments.develop.secretsFile),
 * keyed by the same names as in the cloud store, e.g.
 *   { "/vexa/dev/database-password": "dev" }
 * so a cold start hook runs the same code locally and in the cloud. There is
 * no fallback to the process environment. The file is read on every call, so
 * edits apply without restarting the dev server.
 * @returns Local secrets service implementation
 */
export function createLocalSecretsService(): SecretsService {
    async function getMany(names: string[]): Promise<Record<string, string>> {
        const unique = [...new Set(names)];
        if (unique.length === 0) return {};

        const file = process.env[SECRETS_FILE_ENV];
        if (!file) {
            throw new Error(
                `No local secrets file configured: set environments.develop.secretsFile in nux.config (default "./.secrets.json"). Asked for: ${unique.join(", ")}`,
            );
        }

        const values = readSecretsFile(file);
        const missing = unique.filter(name => values[name] === undefined);
        if (missing.length > 0) {
            throw new SecretsNotFoundError(missing, file);
        }
        return Object.fromEntries(unique.map(name => [name, values[name]]));
    }

    return {
        async get(name: string): Promise<string> {
            return (await getMany([name]))[name];
        },
        getMany,
    };
}
