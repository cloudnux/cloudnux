import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/cli.ts'],
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
    shims: true,
    banner: {
        js: '#!/usr/bin/env node'
    }
})
