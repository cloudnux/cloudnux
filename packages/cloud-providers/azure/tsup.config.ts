import { defineConfig } from 'tsup'

export default defineConfig([
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
        shims: false,
        cjsInterop: true,
        external: [
            '@cloudnux/core-cloud-provider'
        ]
    },
])
