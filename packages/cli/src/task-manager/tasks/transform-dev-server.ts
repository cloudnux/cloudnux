import fs from "node:fs/promises";
import path from "node:path";

import { Task } from "../../types.js";
import { buildServiceOverrides } from "../build-service-overrides.js";

/**
 * convert the module template into a compilable function
 * @param {string} moduleNames
 * @param {string} devServerTemplateFunc
 * @param {string} workingDir
 * @param {string} namespace this dev server's namespace
 * @param {Record<string,string>} namespaces namespace -> dev server url of other namespaces
 */
export const transformDevServer: Task = {
    title: `Transform Dev Server`,
    skip: () => false,
    action: async ({
        moduleNames,
        devServerTemplateFunc,
        workingDir,
        port,
        services,
        namespace,
        namespaces,
    }) => {
        const rendered = devServerTemplateFunc({
            source: "./src",
            moduleNames,
            port,
            envDir: path.resolve(workingDir),
            serviceOverrides: buildServiceOverrides(services),
            namespace,
            namespaces,
        });

        await fs.mkdir(path.join(workingDir), { recursive: true });
        await fs.writeFile(path.join(workingDir, `app.ts`), rendered, "utf-8");
    }
}