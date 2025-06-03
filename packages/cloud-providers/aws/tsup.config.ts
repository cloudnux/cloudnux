import { defineConfig } from 'tsup'

export default defineConfig([
    // Main package build
    {
        entry: ['src/index.ts'],
        format: ['cjs', 'esm'],
        dts: true,
        splitting: false,
        sourcemap: true,
        clean: false,
        minify: false,
        target: 'node18',
        outDir: 'dist',
        noExternal: [/.*/],
        external: [
            '@cloudnux/core-cloud-provider'
        ]
    },
    //router package build
    {
        entry: ['src/router/index.ts'],
        format: ['cjs', 'esm'],
        dts: true,
        splitting: false,
        sourcemap: true,
        clean: false, // Don't clean since we're building multiple entries
        minify: false,
        target: 'node18',
        outDir: 'dist/router',
        noExternal: [/.*/],
        external: [
            '@cloudnux/core-cloud-provider',
        ]
    },

])