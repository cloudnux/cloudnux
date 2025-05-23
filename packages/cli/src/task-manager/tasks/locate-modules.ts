import path from "node:path";
import fg from "fast-glob";

import { Task } from "../../types.js";
import { transformModule } from "./transform-module.js";
import { locateSourceEntry } from "./locate-source-entry.js";
import { transformTriggerTemplate } from "./transform-trigger-template.js";
import { buildServer } from "./build-server.js";

/**
 * identify the module entry point paths
 * @param {string} modulesPath
 * @returns {string[]} entrypoint paths
 */
export const locateModules: Task = {
    title: "load all entrypoints.json",
    skip: () => false,
    action: async (params, _logger, _eventEmitter, executeSubTasks) => {
        const entrypoints = await fg(params.modulesPath);
        const moduleNames = entrypoints.map((entrypoint) => path.basename(path.dirname(entrypoint)));
        let output = {
            entrypoints,
            moduleNames
        };

        for (const entrypoint of entrypoints) {
            const taskOutput = await executeSubTasks!({
                ...params,
                entrypointPath: entrypoint,
                moduleName: path.basename(path.dirname(entrypoint))
            });
            output = {
                ...output,
                ...taskOutput
            }
        }
        return output;
    },
    children: [
        locateSourceEntry,
        transformModule,
        transformTriggerTemplate,
        buildServer
    ]
}