import path from "node:path";
import { fork } from "node:child_process";
import esbuild from "esbuild";

import { Task } from "../../types.js";

export const devServerWatch: Task = {
    title: 'Dev Server Watch',
    skip: () => false,
    action: async (params) => {
        const { workingDir, logger, eventEmitter, externalPackages } = params;
        const entryPath = path.resolve(workingDir, "app.ts");
        const outputFile = path.resolve(workingDir, "index.mjs");

        let child: ReturnType<typeof fork> | null = null;

        const ctx = await esbuild.context({
            format: "esm",
            banner: {
                js: `
                    import __node_module from 'node:module';
                    import __node_url from 'node:url';
                    import __node_path from 'node:path';
                    const require = __node_module.createRequire(import.meta.url);
                    const __filename = __node_url.fileURLToPath(import.meta.url);
                    const __dirname = __node_path.dirname(__filename);
                    `.trim()
            },
            external: [...externalPackages],
            entryPoints: { index: entryPath },
            absWorkingDir: workingDir,
            bundle: true,
            sourcemap: true,
            minify: false,
            outdir: workingDir,
            outExtension: { ".js": ".mjs" },
            platform: "node",
            define: {
                __ENV_PATH__: '"' + path.resolve(workingDir, "../../.env").replace(/\\/g, "\\\\") + '"',
                __DEV__: process.env.__DEV__ || '"development"',
            },
            plugins: [
                {
                    name: "restart-on-build",
                    setup(build) {
                        build.onEnd(({ errors }) => {
                            if (errors.length > 0) return;

                            if (child) {
                                child.kill("SIGINT");
                                if (!child.killed) {
                                    console.error(`cannot stop process ${child.pid}`);
                                }
                            }
                            child = startModule(outputFile, ["--enable-source-maps"], logger, eventEmitter);
                        });
                    }
                }
            ]
        });

        await ctx.watch();
    }
}

function startModule(main: string, execArgv: string[], logger: any, eventEmitter: (type: string, data?: any) => void) {
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
