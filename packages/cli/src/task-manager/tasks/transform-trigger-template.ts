import fs from "node:fs/promises";
import path from "node:path";

import { Task } from "../../types.js";

/**
 * convert the module trigger template into a compilable function 
 * @param {string} triggerTemplatePath
 * @param {string} entrypointPath
 * @param {string} moduleName
 * @param {string} workingDir
 * @param {string} source
 */
export const transformTriggerTemplate: Task = {
    title: ({ moduleName }) => `Transform terraform trigger ${moduleName}`,
    skip: (params) => {
        return params.environment === "develop";
    },
    action: async ({
        triggerTemplateFunc,
        entrypointPath,
        moduleName,
        workingDir,
        source,
    }) => {
        const entrypointContent = await fs.readFile(entrypointPath, "utf-8");
        const rendered = triggerTemplateFunc({
            source: (process.platform === "win32") ? source.replace(/\\/g, "/") : source,
            module: moduleName,
            ...JSON.parse(entrypointContent),

        });


        // if folder does not exist, create it
        const moduleDir = path.join(workingDir, moduleName);
        await fs.mkdir(moduleDir, { recursive: true });
        await fs.writeFile(path.join(moduleDir, `${moduleName}-triggers.tf`), rendered, "utf-8");

    }
}