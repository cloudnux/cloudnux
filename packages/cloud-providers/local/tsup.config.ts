import { defineConfig } from 'tsup'

export default defineConfig([
    // Main package build
    {
        entry: ['src/index.ts'],
        format: ['esm'],
        platform: "node",
        dts: true,
        splitting: false,
        sourcemap: true,
        clean: true,
        minify: false,
        target: 'es2024',
        outDir: 'dist',
        shims: false,
        cjsInterop: true,
    },
    // Queue plugin build
    {
        entry: ['src/queue-plugin/index.ts'],
        format: ['esm'],
        platform: "node",
        dts: true,
        splitting: false,
        sourcemap: true,
        clean: false, // Don't clean since we're building multiple entries
        minify: false,
        target: 'es2024',
        cjsInterop: true,
        outDir: 'dist/queue-plugin',
        shims: false,
    },
    // Schedule plugin build
    {
        entry: ['src/schedule-plugin/index.ts'],
        format: ['esm'],
        platform: "node",
        dts: true,
        splitting: false,
        sourcemap: true,
        clean: false, // Don't clean since we're building multiple entries
        minify: false,
        target: 'es2024',
        cjsInterop: true,
        outDir: 'dist/schedule-plugin',
        shims: false,
    },
    // web socket plugin build
    {
        entry: ['src/websocket-plugin/index.ts'],
        format: ['esm'],
        platform: "node",
        dts: true,
        splitting: false,
        sourcemap: true,
        clean: false, // Don't clean since we're building multiple entries
        minify: false,
        target: 'es2024',
        cjsInterop: true,
        outDir: 'dist/websocket-plugin',
        shims: false,
    },
    //dev console plugin build
    {
        entry: ['src/dev-console-plugin/index.ts'],
        format: ['esm'],
        platform: "node",
        dts: true,
        splitting: false,
        sourcemap: true,
        clean: false, // Don't clean since we're building multiple entries
        minify: false,
        target: 'es2024',
        cjsInterop: true,
        outDir: 'dist/dev-console-plugin',
        shims: false,
    }
])
