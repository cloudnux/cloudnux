import path from "node:path";
import tsup from "tsup";

import { Task } from "../../types.js";

export const buildServer: Task = {
    title: ({ moduleName }) => `Build Server for ${moduleName}`,
    skip: () => false,
    action: async ({ moduleDir, externalPackages }) => {
        const modulePath = path.resolve(moduleDir, "index.ts");
        return await tsup.build({
            entry: {
                index: modulePath,
            },
            external: [...externalPackages],
            noExternal: ['lodash'],
            esbuildOptions: (options) => {
                options.absWorkingDir = moduleDir;
                return options;
            },
            format: ["esm"],
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
            outExtension: () => ({ js: '.mjs' }),
            bundle: true,
            sourcemap: true,
            minify: false,
            outDir: moduleDir,
            platform: "node",
            dts: false,
            watch: false,
            shims: false,
            define: {
                __DEV__: process.env.__DEV__ || "false",
            },
            esbuildPlugins: [],
        });
    }
}