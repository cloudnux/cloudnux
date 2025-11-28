import { defineConfig } from 'tsup'

export default defineConfig([
    // Main package build
    {
        entry: ['src/index.ts'],
        format: ['esm'],
        dts: true,
        splitting: false,
        sourcemap: true,
        clean: true,
        minify: false,
        target: 'es2024',
        outDir: 'dist',
        shims: true,
        cjsInterop: true,
        noExternal: [/.*/],
        external: [
            '@cloudnux/core-cloud-provider'
        ]
    },
    //router package build
    {
        entry: ['src/router/index.ts'],
        format: ['esm'],
        dts: true,
        splitting: false,
        sourcemap: true,
        clean: false, // Don't clean since we're building multiple entries
        minify: false,
        target: 'es2024',
        outDir: 'dist/router',
        cjsInterop: true,
        shims: true,
        noExternal: [/.*/],
        external: [
            '@cloudnux/core-cloud-provider',
        ]
    },

])