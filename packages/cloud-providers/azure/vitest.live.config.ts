import { defineConfig } from 'vitest/config';

// Live tests against real Azure resources: `yarn test:live`.
// See scripts/live-env.sh to create the resources and README.md ("Live tests").
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/__tests__/live/**/*.live.test.ts'],
        globalSetup: ['./src/__tests__/live/global-setup.ts'],
        reporters: ['tree'],
        testTimeout: 30_000,
        hookTimeout: 60_000,
        // One file at a time keeps the output readable and the Service Bus queue to one consumer.
        fileParallelism: false,
    },
});
