import * as path from 'path';

import { env } from "@cloudnux/utils";

/**
 * Validate a directory setting. There are no fallbacks: every local data folder
 * lives inside the environment folder, and the generated dev server resolves it
 * to an absolute path before the provider ever sees it.
 * @param value The configured directory
 * @param name Name of the setting, used in error messages
 * @returns The directory, guaranteed absolute
 */
export function requireAbsoluteDir(value: string | undefined, name: string): string {
    if (!value) {
        throw new Error(`${name} is not set. The dev server must set it to a folder inside the environment folder.`);
    }
    if (!path.isAbsolute(value)) {
        throw new Error(`${name} must be an absolute path, got "${value}".`);
    }
    return value;
}

/**
 * Read a directory from an environment variable, see requireAbsoluteDir
 * @param envName Environment variable name
 * @returns The directory, guaranteed absolute
 */
export function requireEnvDir(envName: string): string {
    return requireAbsoluteDir(env(envName), envName);
}
