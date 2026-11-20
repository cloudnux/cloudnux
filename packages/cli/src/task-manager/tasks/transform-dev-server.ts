import fs from "node:fs/promises";
import path from "node:path";

import { Task } from "../../types.js";
import { buildServiceOverrides } from "../build-service-overrides.js";
import { buildHookImports } from "../build-hooks.js";

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
        hooks,
        namespace,
        namespaces,
        secretsFile,
    }) => {
        if (secretsFile !== undefined && typeof secretsFile !== "string") {
            throw new Error("environments.develop.secretsFile must be a string path");
        }
        const rendered = devServerTemplateFunc({
            source: "./src",
            moduleNames,
            port,
            envDir: path.resolve(workingDir),
            serviceOverrides: buildServiceOverrides(services),
            hooks: buildHookImports(hooks),
            // absolute, so the dev server finds it whatever its working directory
            secretsFile: secretsFile ? path.resolve(process.cwd(), secretsFile) : undefined,
            namespace,
            namespaces,
        });

        await fs.mkdir(path.join(workingDir), { recursive: true });
        await fs.writeFile(path.join(workingDir, `app.ts`), rendered, "utf-8");
    }
}