import findupSync from "findup-sync";
import fs from "node:fs/promises";
import path from "node:path";

import { Task } from "../../types.js";

/**
 * convert the module template into a compilable function 
 * @param {string} moduleTemplatePath
 * @returns {function} moduleTemplateFunc
 */

async function getPackageEntryPaths(packagePath: string): Promise<string[]> {
    const content = await fs.readFile(packagePath, 'utf-8');
    const pkg = JSON.parse(content);
    const pkgDir = path.dirname(packagePath);
    const paths = new Set<string>();

    // Add main/module entries
    [pkg.main, pkg.module]
        .filter(Boolean)
        .forEach(entry => paths.add(path.join(pkgDir, entry as string)));

    // Process exports
    if (pkg.exports) {
        const exportPaths = Object.entries(pkg.exports)
            .filter(([_, value]) => {
                if (typeof value === 'string') {
                    return value.endsWith('.ts') || value.endsWith('.tsx');
                }
                return false;
            })
            .map(([_, value]) => path.join(pkgDir, value as string));

        exportPaths.forEach(path => paths.add(path));
    }

    return Array.from(paths);
}

export const locateSourceEntry: Task = {
    title: ({ moduleName }) => `Locate source for module ${moduleName}`,
    skip: () => false,
    action: async ({ moduleName, entrypointPath }) => {
        const pkgJson = findupSync("package.json", { cwd: path.dirname(entrypointPath) });
        if (!pkgJson) {
            throw new Error("Could not locate package.json for module" + moduleName);
        }
        const entries = await getPackageEntryPaths(pkgJson);
        return {
            source: entries[0]
        }
    }
}