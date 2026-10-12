import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

import { storagePlugin } from '../../storage-plugin';
import { createLocalStorageService } from '../../services/storage';
import { createTempDir, cleanupDir } from '../helpers/test-utils';

describe('storage-plugin', () => {
  let tempDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    tempDir = createTempDir();
    process.env.DEV_CLOUD_STORAGE_BUCKET = tempDir;
    app = Fastify();
    await app.register(storagePlugin, { prefix: '__storage' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    cleanupDir(tempDir);
    delete process.env.DEV_CLOUD_STORAGE_BUCKET;
  });

  it('serves an object at /__storage/<bucket>/<encoded key> for nested keys', async () => {
    const storage = createLocalStorageService();
    const { bucket, encodedKey } = await storage.write('invoices/2026/oct report.txt', 'hello', 'docs');

    const res = await app.inject({ method: 'GET', url: `/__storage/${bucket}/${encodedKey}` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('hello');
  });

  it('uses the content type recorded at write time', async () => {
    const storage = createLocalStorageService();
    const { encodedKey } = await storage.write('data.bin', '{}', 'docs', { contentType: 'application/json' });

    const res = await app.inject({ method: 'GET', url: `/__storage/docs/${encodedKey}` });

    expect(res.headers['content-type']).toContain('application/json');
  });

  it('ignores acl and serves private objects', async () => {
    const storage = createLocalStorageService();
    const { encodedKey } = await storage.write('secret.txt', 'shh', 'docs', { acl: 'private' });

    const res = await app.inject({ method: 'GET', url: `/__storage/docs/${encodedKey}` });

    expect(res.statusCode).toBe(200);
  });

  it('never serves metadata sidecars', async () => {
    const storage = createLocalStorageService();
    await storage.write('file.txt', 'x', 'docs', { contentType: 'text/plain' });

    const res = await app.inject({ method: 'GET', url: '/__storage/docs/file.txt.metadata.json' });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for missing objects', async () => {
    const res = await app.inject({ method: 'GET', url: '/__storage/docs/missing.txt' });
    expect(res.statusCode).toBe(404);
  });
});

describe('storage-plugin configuration', () => {
  it('fails to register without DEV_CLOUD_STORAGE_BUCKET', async () => {
    delete process.env.DEV_CLOUD_STORAGE_BUCKET;
    const app = Fastify();
    app.register(storagePlugin);
    await expect(app.ready()).rejects.toThrow('DEV_CLOUD_STORAGE_BUCKET is not set');
  });
});
