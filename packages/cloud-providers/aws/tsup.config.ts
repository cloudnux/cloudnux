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
        external: [
            '@cloudnux/core-cloud-provider'
        ],
        esbuildOptions(options) {
            options.conditions = ['module']
        },
    }
])