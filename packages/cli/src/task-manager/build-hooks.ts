import { Hooks } from "../types.js";

export type HookImports = {
    /** forward-slash path of the cold start hook module, safe to embed in a generated import */
    coldStart?: string;
}

/**
 * Converts the `hooks` config into values ready to splice into a template.
 * Paths are already absolute (resolved in loadConfig); on Windows the
 * separators are turned into forward slashes so the generated import works.
 */
export function buildHookImports(hooks: Hooks = {}): HookImports {
    const toImportPath = (modulePath: string) =>
        process.platform === "win32" ? modulePath.replace(/\\/g, "/") : modulePath;

    return {
        coldStart: hooks.coldStart ? toImportPath(hooks.coldStart) : undefined,
    };
}
