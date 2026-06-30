import { beforeAll, afterAll } from 'vitest';
import { LoggerService, registerService } from '@cloudnux/core-cloud-provider';

import { createLocalLoggerService } from '../services/logger';

// Tests construct services (createLocalStorageService, createLocalLocationService,
// ...) directly, bypassing the @cloudnux/sdk useCloudProvider() bootstrap that
// normally registers "logger" into the cloud-container. Register it here the same
// way @cloudnux/sdk's cloudLogger() does - a memoized singleton factory, not the
// raw provider factory - so any service's `getService<LoggerService>("logger")`
// call resolves in tests too, under the same contract production relies on.
let _logger: LoggerService | null = null;
registerService('logger', () => {
  if (!_logger) {
    _logger = createLocalLoggerService();
  }
  return _logger;
});

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
