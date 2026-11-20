import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecretsNotFoundError } from '@cloudnux/core-cloud-provider';

import { createLocalSecretsService, SECRETS_FILE_ENV } from '../../services/secrets';
import { createTempDir, cleanupDir } from '../helpers/test-utils';

describe('LocalSecretsService', () => {
  let dir: string;
  let file: string;

  const writeSecrets = (content: unknown) =>
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));

  beforeEach(() => {
    dir = createTempDir();
    file = path.join(dir, '.secrets.json');
    process.env[SECRETS_FILE_ENV] = file;
  });

  afterEach(() => {
    cleanupDir(dir);
    delete process.env[SECRETS_FILE_ENV];
    delete process.env.DATABASE_PASSWORD;
  });

  it('reads secrets by the same names as the cloud store', async () => {
    writeSecrets({ '/vexa/dev/database-password': 'dev', '/vexa/dev/apple/private-key': '-----BEGIN-----\nabc\n-----END-----' });
    const secrets = createLocalSecretsService();

    expect(await secrets.get('/vexa/dev/database-password')).toBe('dev');
    expect(await secrets.getMany(['/vexa/dev/database-password', '/vexa/dev/apple/private-key'])).toEqual({
      '/vexa/dev/database-password': 'dev',
      '/vexa/dev/apple/private-key': '-----BEGIN-----\nabc\n-----END-----',
    });
  });

  it('picks up edits without a restart', async () => {
    writeSecrets({ a: '1' });
    const secrets = createLocalSecretsService();
    expect(await secrets.get('a')).toBe('1');
    writeSecrets({ a: '2' });
    expect(await secrets.get('a')).toBe('2');
  });

  it('does not fall back to the process environment', async () => {
    writeSecrets({});
    process.env.DATABASE_PASSWORD = 'from-env';
    await expect(createLocalSecretsService().get('DATABASE_PASSWORD')).rejects.toBeInstanceOf(SecretsNotFoundError);
  });

  it('names every missing secret and the file', async () => {
    writeSecrets({ a: '1' });
    const error = await createLocalSecretsService().getMany(['a', 'b', 'c']).catch(e => e);
    expect(error).toBeInstanceOf(SecretsNotFoundError);
    expect(error.names).toEqual(['b', 'c']);
    expect(error.message).toContain(file);
  });

  it('treats a missing file as no secrets', async () => {
    const error = await createLocalSecretsService().get('a').catch(e => e);
    expect(error).toBeInstanceOf(SecretsNotFoundError);
    expect(error.message).toContain(file);
  });

  it('explains when no file is configured', async () => {
    delete process.env[SECRETS_FILE_ENV];
    await expect(createLocalSecretsService().get('a')).rejects.toThrow(/environments\.develop\.secretsFile/);
  });

  it('rejects invalid JSON and non-string values', async () => {
    writeSecrets('{ not json');
    await expect(createLocalSecretsService().get('a')).rejects.toThrow(/not valid JSON/);
    writeSecrets({ a: { nested: true } });
    await expect(createLocalSecretsService().get('a')).rejects.toThrow(/must be a string/);
  });
});
