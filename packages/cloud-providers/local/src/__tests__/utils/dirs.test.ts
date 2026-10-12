import { describe, it, expect, afterEach } from 'vitest';

import { requireAbsoluteDir, requireEnvDir } from '../../utils/dirs';

describe('requireAbsoluteDir', () => {
  it('returns an absolute path unchanged', () => {
    expect(requireAbsoluteDir('/tmp/env/.queue-data', 'x')).toBe('/tmp/env/.queue-data');
  });

  it('throws when the value is missing or empty', () => {
    expect(() => requireAbsoluteDir(undefined, 'queues persistence.directory')).toThrow('queues persistence.directory is not set');
    expect(() => requireAbsoluteDir('', 'queues persistence.directory')).toThrow('is not set');
  });

  it('throws when the value is relative', () => {
    expect(() => requireAbsoluteDir('./.develop/.queue-data', 'x')).toThrow('must be an absolute path');
  });
});

describe('requireEnvDir', () => {
  afterEach(() => {
    delete process.env.DEV_CLOUD_TEST_DIR;
  });

  it('reads and validates an environment variable', () => {
    process.env.DEV_CLOUD_TEST_DIR = '/tmp/env/x';
    expect(requireEnvDir('DEV_CLOUD_TEST_DIR')).toBe('/tmp/env/x');
  });

  it('throws when the environment variable is missing or relative', () => {
    expect(() => requireEnvDir('DEV_CLOUD_TEST_DIR')).toThrow('DEV_CLOUD_TEST_DIR is not set');
    process.env.DEV_CLOUD_TEST_DIR = 'relative';
    expect(() => requireEnvDir('DEV_CLOUD_TEST_DIR')).toThrow('must be an absolute path');
  });
});
