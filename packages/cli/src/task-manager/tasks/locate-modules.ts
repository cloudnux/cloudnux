import { Task } from "../../types.js";
/**
 * identify the module entry point paths
 * @param {string} modulesPath
 * @returns {string[]} entrypoint paths
 */
export const locateModules: Task = {
    title: "load all entrypoints.json",
    skip: () => false,
    action: async (params) => {
        const { executeSubTasks, modules } = params;

        const entrypoints = Object.entries(modules) as [string, string][];
        let output = {
            entrypoints: Object.values(modules),
            moduleNames: Object.keys(modules)
        };
        for (const [moduleName, modulePath] of entrypoints) {
            const taskOutput = await executeSubTasks!({
                ...params,
                entrypointPath: modulePath,
                moduleName: moduleName
            });
            output = {
                ...output,
                ...taskOutput
            }
        }
        return output;
    }
}