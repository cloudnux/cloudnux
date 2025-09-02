import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/cli.tsx'],
    format: ['esm'],
    platform: "node",
    outExtension: () => {
        return {
            js: '.mjs',
        }
    },
    target: 'es2024',
    dts: true,
    clean: false,
    splitting: false,
    publicDir: "src/assets",
    shims: true,
    banner: {
        js: '#!/usr/bin/env node'
    }
})