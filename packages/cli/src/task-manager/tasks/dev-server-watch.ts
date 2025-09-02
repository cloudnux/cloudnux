import path from "node:path";
import { fork } from "node:child_process";
import tsup from "tsup";
import { PluginBuild } from "esbuild";

import { Task, TaskParam } from "../../types.js";

// function mapCloud(provider: string) {
//     switch (provider) {
//         case "aws":
//             return "@cloudnux/aws-cloud-provider";
//         case "azure":
//             return "@cloudnux/azure-cloud-provider";
//         case "gcp":
//             return "@cloudnux/gcp-cloud-provider";
//         default:
//             return provider;
//     }
// }

export const devServerWatch: Task = {
    title: 'Dev Server Watch',
    skip: () => false,
    action: async (params: TaskParam) => {
        const { workingDir, logger, eventEmitter } = params;
        const entryPath = path.resolve(workingDir, "app.ts");
        await tsup.build({
            entry: {
                index: entryPath
            },
            esbuildOptions: (options) => {
                options.absWorkingDir = workingDir;
                return options;
            },
            format: ["cjs"],
            bundle: true,
            noExternal: [],
            sourcemap: true,
            minify: false,
            outDir: workingDir,
            platform: "node",
            cjsInterop: true,
            shims: true,
            dts: false,
            watch: false,
            env: {
                __ENV_PATH__: '"' + path.resolve(workingDir, "../../.env").replace(/\\/g, "\\\\") + '"',
                __DEV__: process.env.__DEV__ || '"development"',
            },
            define: {
                __ENV_PATH__: '"' + path.resolve(workingDir, "../../.env").replace(/\\/g, "\\\\") + '"',
                __DEV__: process.env.__DEV__ || '"development"',
            },
            esbuildPlugins: [
                {
                    name: "capture-logs",
                    setup: (build) => {
                        build.onEnd((buildResult) => {
                            if (buildResult.errors.length > 0) {
                                buildResult.errors.forEach(logger);
                            }
                            if (buildResult.warnings.length > 0) {
                                buildResult.warnings.forEach(logger);
                            }
                        });
                    }
                },
                startServerPlugin(logger, eventEmitter)
            ],
            silent: true // Prevent console output
        });
    }
}

function startModule(main: any, execArgv: any, logger: any, eventEmitter: (type: string, data?: any) => void) {
    const child = fork(main, { env: process.env, execArgv });

    child.on('message', (message: { type: string; payload: any }) => {
        switch (message.type) {
            case 'ERROR':
                logger('Error:', message.payload);
                eventEmitter(message.type, message.payload);
                break;
            case 'APP_REGISTERED':
            case 'ROUTE_REGISTERED':
            case 'LISTENING':
            case 'REQUEST':
            case 'RESPONSE':
            case 'LOG':
                eventEmitter(message.type, message.payload);
                break;
            default:
                break;
        }
    });

    child.on("error", function (error) {
        console.error(error);
        child.kill("SIGINT");
    });

    child.on("close", function () {
        child.kill("SIGINT");
    });
    return child;
}

function startServerPlugin(logger: any, eventEmitter: (type: string, data?: any) => void) {
    logger("Starting server plugin");
    return {
        name: "start servers",
        setup(build: PluginBuild) {
            /** @type ChildProcess  */
            let child: any;
            build.onEnd(async function ({ errors, outputFiles }) {
                if (child) {
                    child.kill("SIGINT");
                    if (!child.killed) {
                        console.error(`cannot stop process ${child.pid}`);
                    }
                }

                if (errors && errors.length > 0) {
                    errors.forEach(logger);
                    return;
                }
                const main = outputFiles?.find(file => file.path.endsWith(".js") || file.path.endsWith(".cjs"))?.path;
                child = startModule(main, ["--enable-source-maps"], logger, eventEmitter);
            });
        },
    }
}