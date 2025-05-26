import { defineConfig } from 'tsup'

export default defineConfig([
    // Main package build
    {
        entry: ['src/index.ts'],
        format: ['cjs', 'esm'],
        dts: true,
        splitting: false,
        sourcemap: true,
        clean: true,
        minify: false,
        target: 'node18',
        outDir: 'dist',
        noExternal: ['@cloudnux/utils'],
        external: [
            '@cloudnux/core-cloud-provider'
        ],
        esbuildOptions(options) {
            options.conditions = ['module']
        },
    },
    // Queue plugin build
    {
        entry: ['src/queue-plugin/index.ts'],
        format: ['cjs', 'esm'],
        dts: true,
        splitting: false,
        sourcemap: true,
        clean: false, // Don't clean since we're building multiple entries
        minify: false,
        target: 'node18',
        outDir: 'dist/queue-plugin',
        external: [
            '@cloudnux/core-cloud-provider',
        ],
        esbuildOptions(options) {
            options.conditions = ['module']
        },
    },
    // Schedule plugin build
    {
        entry: ['src/schedule-plugin/index.ts'],
        format: ['cjs', 'esm'],
        dts: true,
        splitting: false,
        sourcemap: true,
        clean: false, // Don't clean since we're building multiple entries
        minify: false,
        target: 'node18',
        outDir: 'dist/schedule-plugin',
        external: [
            '@cloudnux/core-cloud-provider',
        ],
        esbuildOptions(options) {
            options.conditions = ['module']
        },
    }
])