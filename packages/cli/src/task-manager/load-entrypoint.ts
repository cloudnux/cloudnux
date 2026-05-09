import fs from "node:fs/promises";
import path from "node:path";

interface EntrypointFile {
    entries?: Record<string, unknown>;
    includes?: string[];
}

export async function loadEntrypoint(entrypointPath: string): Promise<{ entries: Record<string, unknown> }> {
    const content = await fs.readFile(entrypointPath, "utf-8");
    const entrypoint = JSON.parse(content) as EntrypointFile;

    const mergedEntries: Record<string, unknown> = { ...entrypoint.entries };

    if (entrypoint.includes && entrypoint.includes.length > 0) {
        const baseDir = path.dirname(entrypointPath);
        for (const includePath of entrypoint.includes) {
            const resolvedPath = path.resolve(baseDir, includePath);
            const includeContent = await fs.readFile(resolvedPath, "utf-8");
            const includeFile = JSON.parse(includeContent) as { entries: Record<string, unknown> };
            Object.assign(mergedEntries, includeFile.entries);
        }
    }

    return { entries: mergedEntries };
}
