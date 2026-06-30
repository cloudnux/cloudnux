import fs from "node:fs/promises";
import path from "node:path";

import { Task } from "../../types.js";
import { loadEntrypoint } from "../load-entrypoint.js";
import { buildServiceOverrides } from "../build-service-overrides.js";

const helpers = {
    $$convertRouteParamstoFastifyRouteTemplate: (route: string) => {
        return route.replace(/{(.*?)}/g, (sub) => ":" + sub.slice(1, -1))
    }
}

export const transformModule: Task = {
    title: ({ moduleName }) => `Transform module ${moduleName}`,
    skip: () => false,
    action: async (params) => {
        const { workingDir, moduleName, entrypointPath, source, moduleTemplateFunc, services } = params;
        const entrypoint = await loadEntrypoint(entrypointPath);
        const rendered = moduleTemplateFunc({
            source: (process.platform === "win32") ? source.replace(/\\/g, "/") : source,
            module: moduleName,
            serviceOverrides: buildServiceOverrides(services),
            ...entrypoint,
            ...helpers
        });

        // if folder does not exist, create it
        const moduleDir = path.join(workingDir, moduleName);
        await fs.mkdir(moduleDir, { recursive: true });
        await fs.writeFile(path.join(moduleDir, `index.ts`), rendered, "utf-8");
        return {
            moduleDir
        }
    }
}