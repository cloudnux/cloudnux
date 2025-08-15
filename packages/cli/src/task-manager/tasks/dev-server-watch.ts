import path from "node:path";
import { fork } from "node:child_process";
import tsup from "tsup";

import { Task, TaskParam } from "../../types.js";

function mapCloud(provider: string) {
    switch (provider) {
        case "aws":
            return "@cloudnux/aws-cloud-provider";
        case "azure":
            return "@cloudnux/azure-cloud-provider";
        case "gcp":
            return "@cloudnux/gcp-cloud-provider";
        default:
            return provider;
    }
}

export const devServerWatch: Task = {
    title: 'Dev Server Watch',
    skip: () => false,
    action: async (params: TaskParam) => {
        const { workingDir, cloudProvider, externalPackages = [], logger, eventEmitter } = params;
        const entryPath = path.resolve(workingDir, "app.ts");
        await tsup.build({
            entry: {
                index: entryPath
            },
            external: [...externalPackages],
            esbuildOptions: (options) => {
                options.absWorkingDir = workingDir;
                return options;
            },
            bundle: true,
            sourcemap: true,
            outDir: workingDir,
            platform: "node",
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
                eventEmitter(message.type, message.payload);
                break;
            case 'ROUTE_REGISTERED':
                eventEmitter(message.type, message.payload);
                break;
            case 'LISTENING':
                debugger;
                eventEmitter(message.type, message.payload);
                break;
            case 'REQUEST':
                eventEmitter(message.type, message.payload);
                break;
            case 'RESPONSE':
                eventEmitter(message.type, message.payload);
                break;
            case 'LOG':
                eventEmitter(message.type, message.payload);
                break;
            case 'log':
                eventEmitter(message.type, message.payload);
                break;  
            default:
                debugger;
                // logger('Unknown message:', message);
                // logger('Issue');
                // console.log('issue',message);
                break;
        }
    });

    child.on("error", function (error) {
        console.error(error);
        child.kill("SIGINT");

    });

    child.on("close", function (code) {
        child.kill("SIGINT");
    });
    return child;
}

function startServerPlugin(logger: any, eventEmitter: (type: string, data?: any) => void) {
    logger("Starting server plugin");
    return {
        name: "start servers",
        setup(build: any) {
            /** @type ChildProcess  */
            let child: any;
            const { outdir, logLevel } = build.initialOptions;
            console.log(outdir, logLevel);
            const main = path.resolve(outdir, "index.cjs");
            build.onEnd(async function ({ errors }: any) {
                if (child) {
                    child.kill("SIGINT");
                    if (!child.killed) {
                        console.error(`cannot stop process ${child.pid}`);
                    }
                }

                if (errors && errors.length > 0) return;
                child = startModule(main, ["--enable-source-maps"], logger, eventEmitter);
            });
        },
    }
}