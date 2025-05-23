import fs from "node:fs/promises";
import path from "node:path";

import { Task } from "../../types.js";

const helpers = {
    $$convertRouteParamstoFastifyRouteTemplate: (route: string) => {
        return route.replace(/{(.*?)}/g, (sub) => ":" + sub.slice(1, -1))
    }
}

/**
 * convert the module template into a compilable function 
 * @param {string} moduleTemplateFunc
 * @returns {function} moduleTemplate
 */
export const transformModule: Task = {
    title: ({ moduleName }) => `Transform module ${moduleName}`,
    skip: () => false,
    action: async ({
        moduleTemplateFunc,
        entrypointPath,
        moduleName,
        workingDir,
        source
    }) => {
        const entrypointContent = await fs.readFile(entrypointPath, "utf-8");
        const rendered = moduleTemplateFunc({
            source: (process.platform === "win32") ? source.replace(/\\/g, "/") : source,
            module: moduleName,
            ...JSON.parse(entrypointContent),
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