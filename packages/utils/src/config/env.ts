import has from "lodash/has";
import trim from "lodash/trim";


//import dotenv from "dotenv";


// if (__DEV__) {
//     dotenv.config({
//         path: __ENV_PATH__
//     })
// }

//function _env(key: keyof EnvKeys, defaultValue?: string): string;
function _env(key: string, defaultValue?: string): string {
    return has(process.env, key)
        ? (process.env[key] ?? "")
        : (defaultValue ?? "");
}

//function int(key: keyof EnvKeys, defaultValue?: number): number;
function int(key: string, defaultValue?: number): number {
    if (!has(process.env, key)) {
        return defaultValue ?? 0;
    }
    const value = process.env[key] ?? "0";
    return parseInt(value, 10);
}

//function float(key: keyof EnvKeys, defaultValue?: number): number;
function float(key: string, defaultValue?: number): number {
    if (!has(process.env, key)) {
        return defaultValue ?? 0;
    }

    const value = process.env[key] ?? "0";
    return parseFloat(value);
}

//function bool(key: keyof EnvKeys, defaultValue?: boolean): boolean;
function bool(key: string, defaultValue?: boolean): boolean {
    if (!has(process.env, key)) {
        return defaultValue ?? false;
    }

    const value = process.env[key];
    return value === 'true';
}

//function json<T = any>(key: keyof EnvKeys, defaultValue?: T): T
function json<T = any>(key: string, defaultValue?: T) {
    if (!has(process.env, key)) {
        return defaultValue ?? {};
    }

    const value = process.env[key] ?? "{}";
    try {
        return JSON.parse(value);
    } catch (error: any) {
        throw new Error(`Invalid json environment variable ${key}: ${error.message}`);
    }
}

//function array(key: keyof EnvKeys, defaultValue?: []): string[];
function array(key: string, defaultValue?: []): Array<any> {
    if (!has(process.env, key)) {
        return defaultValue ?? [];
    }

    let value = process.env[key] ?? "";

    if (value.startsWith('[') && value.endsWith(']')) {
        value = value.substring(1, value.length - 1);
    }

    return value.split(',').map((v) => {
        return trim(trim(v, ' '), '"');
    });
}

//function date(key: keyof EnvKeys, defaultValue?: Date): Date;
function date(key: string, defaultValue?: Date): Date {
    if (!has(process.env, key)) {
        return defaultValue ?? new Date();
    }

    const value = process.env[key] ?? Date()
    return new Date(value);
}

const utils = {

    int,

    float,

    bool,

    json,

    array,

    date,

    /**
     * Gets a value from env that matches oneOf provided values
     * @param {string} key
     * @param {string[]} expectedValues
     * @param {string|undefined} defaultValue
     * @returns {string|undefined}
     */
    oneOf(key: string, expectedValues: string[], defaultValue?: string): string {
        if (!expectedValues) {
            throw new Error(`env.oneOf requires expectedValues`);
        }

        if (defaultValue && !expectedValues.includes(defaultValue)) {
            throw new Error(`env.oneOf requires defaultValue to be included in expectedValues`);
        }

        const rawValue = env(key as any, defaultValue);
        return expectedValues.includes(rawValue) ? rawValue : (defaultValue ?? "");
    },
};

export const env = Object.assign(_env, utils);