import { beforeAll, afterAll } from 'vitest';

// Store original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

// Silence console output during tests
beforeAll(() => {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  // Keep error logs for debugging test failures
  // console.error = () => {};
});

// Restore console after tests
afterAll(() => {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});
