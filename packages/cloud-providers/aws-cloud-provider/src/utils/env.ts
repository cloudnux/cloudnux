import has from "lodash/has";

export function env(key: string, defaultValue?: string) {
    return has(process.env, key) ? process.env[key] : defaultValue;
};