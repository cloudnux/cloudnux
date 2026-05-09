import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/cli.ts', 'src/types.ts', 'src/index.ts'],
    format: ['esm'],
    platform: "node",
    outExtension: () => {
        return {
            js: '.mjs',
        }
    },
    target: 'es2024',
    dts: true,
    clean: true,
    splitting: false,
    publicDir: "src/assets",
    shims: true,
    banner: {
        js: '#!/usr/bin/env node'
    }
})