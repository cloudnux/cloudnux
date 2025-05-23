import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/cli.tsx'],
    format: ['esm'],
    target: "es2022",
    dts: true,
    clean: false,
    splitting: false,
    shims: true,
    publicDir: "src/assets",
    banner: {
        js: '#!/usr/bin/env node'
    }
})

// export default defineConfig({
//     entry: ['src/cli.tsx'],
//     format: ["cjs"],
//     clean: true,
//     dts: true,
//     splitting: false,
//     sourcemap: true,
//     minify: false,
//     outDir: 'dist',
//     target: 'node20',
//     publicDir: "src/templates",
//     bundle: true,
//     skipNodeModulesBundle: false,
//     noExternal: [/(.*)/],
//     loader: {
//         '.json': 'json'
//     }
// });
