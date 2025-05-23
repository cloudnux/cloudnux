import fs from 'node:fs';
import path from "node:path";
import rechoir from 'rechoir';
import { extensions } from 'interpret';
import findUp from "findup-sync";

import { Config } from '../types.js';
import { defaultConfig } from './defaults.js';
import { validateConfig } from "./validator.js";

const CONFIG_FILE_NAMES = ['epf.config', 'epfrc'];

async function resolveConfig(
    config: unknown,
    configContext?: any
) {
    if (typeof config === 'function') {
        try {
            // Handle both async and sync functions
            const resolvedConfig = (await Promise.resolve(config(configContext)));
            if (!resolvedConfig || typeof resolvedConfig !== 'object') {
                throw new Error('Config function must return an object');
            }
            return resolvedConfig as Config;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error executing config function: ${error?.message}`);
            } else {
                throw new Error('Error executing config function');
            }
        }
    }
    return config as Config;
}

/**
 * Loads the configuration file for the application.
 *
 * @template TTaskParams - The type of the task parameters, defaults to a record with string keys and values.
 * @param {string | null} [configPath=null] - The path to the configuration file. If not provided, the function will search for a config file in the current directory.
 * @returns {Promise<Config<TTaskParams>>} - A promise that resolves to the loaded configuration object.
 * @throws {Error} - Throws an error if there is an error loading the config file.
 *
 * The function performs the following steps:
 * 1. Checks if the provided configPath exists, and throws an error if provided path does not exists.
 * 2. If no configPath is provided, searches for a config file in the current directory and upwards.
 * 3. If a config file is found, prepares it using `rechoir`.
 * 4. Loads the config file based on its extension (supports JSON and other formats).
 * 5. Resolves the raw config and merges it with the default config to ensure all fields exist.
 * 6. Validates the merged config and returns it if valid.
 * 7. Throws an error if there is an issue loading the config.
 */
export async function loadConfig(
    configPath: string | null = null
): Promise<Config> {

    // Check if the configPath provided file exists
    let configFile = configPath;
    if (configFile && !fs.existsSync(configFile)) {
        throw new Error(`Config file not found: ${configFile}`);
    }
    //============================================================================
    // no file provided, search for the config file in the current directory
    if (!configFile) {
        const searchPath = process.cwd();
        const filePaths = CONFIG_FILE_NAMES.map(name => `${name}{${Object.keys(extensions).join(',')}}`);
        configFile = findUp(filePaths, { cwd: searchPath });

        if (!configFile) {
            return defaultConfig;
        }
    }

    const result = rechoir.prepare(extensions, configFile);
    if (result === true || (Array.isArray(result) && result.length === 0)) {
        // Successfully loaded
        const ext = path.extname(configFile);

        const osSpecificImportPath = (process.platform === "win32") ? "file:///" : "";
        let rawConfig;
        if (ext === ".json") {
            rawConfig = await import(osSpecificImportPath + configFile);
        }
        else{
            rawConfig = await import(osSpecificImportPath + configFile);
        }

        rawConfig = await resolveConfig(rawConfig.default);
        // Merge with default config to ensure all fields exist
        const mergedConfig = {
            ...defaultConfig,
            ...rawConfig,
            environments: {
                ...defaultConfig.environments,
                ...(rawConfig.environments || {}),
            },
        };

        if (validateConfig(mergedConfig))
            return mergedConfig;
    }

    if (Array.isArray(result) && result[0].error) {
        throw new Error(`Failed to load config: ${result[0].error.message}`);
    }

    throw new Error('Unknown error occurred while loading config');
}