import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/__tests__/**/*.{test,spec}.ts'],
        // Live tests hit real Azure; they run only via `yarn test:live`.
        exclude: ['node_modules', 'dist', 'src/__tests__/live/**'],
        // Starts an in-memory Azurite blob server on a free port for the whole run.
        globalSetup: ['./src/__tests__/global-setup.ts'],
        reporters: ['tree'],
        testTimeout: 15000,
    },
});
