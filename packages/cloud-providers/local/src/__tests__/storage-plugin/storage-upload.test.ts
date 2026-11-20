import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { EventBrokerService, registerService } from '@cloudnux/core-cloud-provider';

import { storagePlugin } from '../../storage-plugin';
import { createLocalStorageService } from '../../services/storage';
import { addNotificationRule } from '../../services/storage-notifications';
import { createTempDir, cleanupDir } from '../helpers/test-utils';

const published: { target: string; message: any }[] = [];
registerService('event-broker', () => ({
  async publish(target: string, message: any) {
    published.push({ target, message });
  },
}) as unknown as EventBrokerService);

/** inject() takes a path; turn a signed URL into path + query */
function pathOf(url: string): string {
  const u = new URL(url);
  return u.pathname + u.search;
}

describe('storage-plugin uploads through signed URLs', () => {
  let tempDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    tempDir = createTempDir();
    process.env.DEV_CLOUD_STORAGE_BUCKET = tempDir;
    process.env.DEV_CLOUD_STORAGE_URL = 'http://localhost:3000/__storage';
    published.length = 0;
    app = Fastify();
    await app.register(storagePlugin, { prefix: '__storage' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    cleanupDir(tempDir);
    delete process.env.DEV_CLOUD_STORAGE_BUCKET;
    delete process.env.DEV_CLOUD_STORAGE_URL;
  });

  it('creates a URL under the storage plugin with the headers to send', async () => {
    const signed = await createLocalStorageService().createUploadUrl('uploads/a b.jpg', 'invoices', { contentType: 'image/jpeg', contentLength: 3 });

    expect(signed.method).toBe('PUT');
    expect(signed.url.startsWith('http://localhost:3000/__storage/invoices/uploads/a%20b.jpg?')).toBe(true);
    expect(signed.headers).toEqual({ 'content-type': 'image/jpeg', 'if-none-match': '*' });
    expect(signed.key).toBe('uploads/a b.jpg');
  });

  it('accepts the signed upload, stores the object and fires the notification rules', async () => {
    await addNotificationRule({ id: 'uploads', bucket: 'invoices', prefix: 'uploads/', events: ['created'], queue: 'invoice-processing' });
    const storage = createLocalStorageService();
    const signed = await storage.createUploadUrl('uploads/a.jpg', 'invoices', { contentType: 'image/jpeg', contentLength: 4 });

    const res = await app.inject({ method: 'PUT', url: pathOf(signed.url), headers: signed.headers, payload: Buffer.from([1, 2, 3, 4]) });

    expect(res.statusCode).toBe(200);
    expect(await storage.read('uploads/a.jpg', 'invoices')).toEqual(Buffer.from([1, 2, 3, 4]));
    expect(published).toHaveLength(1);
    expect(published[0].message).toMatchObject({ bucket: 'invoices', key: 'uploads/a.jpg', size: 4, contentType: 'image/jpeg' });

    // and the uploaded object is served back with its content type
    const get = await app.inject({ method: 'GET', url: '/__storage/invoices/uploads/a.jpg' });
    expect(get.statusCode).toBe(200);
    expect(get.headers['content-type']).toContain('image/jpeg');
  });

  it('accepts JSON and text bodies as raw bytes', async () => {
    const signed = await createLocalStorageService().createUploadUrl('data.json', 'docs', { contentType: 'application/json' });
    const res = await app.inject({ method: 'PUT', url: pathOf(signed.url), headers: signed.headers, payload: '{"a":1}' });
    expect(res.statusCode).toBe(200);
    expect((await createLocalStorageService().read('data.json', 'docs')).toString()).toBe('{"a":1}');
  });

  it('refuses a second upload to the same key (If-None-Match)', async () => {
    const storage = createLocalStorageService();
    const signed = await storage.createUploadUrl('once.txt', 'docs', { contentType: 'text/plain' });

    const first = await app.inject({ method: 'PUT', url: pathOf(signed.url), headers: signed.headers, payload: 'one' });
    const second = await app.inject({ method: 'PUT', url: pathOf(signed.url), headers: signed.headers, payload: 'two' });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(412);
    expect((await storage.read('once.txt', 'docs')).toString()).toBe('one');
  });

  it('allows replacing when the URL was created with overwrite', async () => {
    const storage = createLocalStorageService();
    const signed = await storage.createUploadUrl('file.txt', 'docs', { contentType: 'text/plain', overwrite: true });
    expect(signed.headers).toEqual({ 'content-type': 'text/plain' });

    await app.inject({ method: 'PUT', url: pathOf(signed.url), headers: signed.headers, payload: 'one' });
    const res = await app.inject({ method: 'PUT', url: pathOf(signed.url), headers: signed.headers, payload: 'two' });

    expect(res.statusCode).toBe(200);
    expect((await storage.read('file.txt', 'docs')).toString()).toBe('two');
  });

  it('rejects a different content type, size, key or a tampered signature', async () => {
    const storage = createLocalStorageService();
    const signed = await storage.createUploadUrl('a.jpg', 'docs', { contentType: 'image/jpeg', contentLength: 2 });

    const wrongType = await app.inject({ method: 'PUT', url: pathOf(signed.url), headers: { ...signed.headers, 'content-type': 'image/png' }, payload: 'ab' });
    const wrongSize = await app.inject({ method: 'PUT', url: pathOf(signed.url), headers: signed.headers, payload: 'abc' });
    const otherKey = await app.inject({ method: 'PUT', url: pathOf(signed.url).replace('/a.jpg', '/b.jpg'), headers: signed.headers, payload: 'ab' });
    const noIfNoneMatch = await app.inject({ method: 'PUT', url: pathOf(signed.url), headers: { 'content-type': 'image/jpeg' }, payload: 'ab' });
    const unsigned = await app.inject({ method: 'PUT', url: '/__storage/docs/a.jpg', headers: signed.headers, payload: 'ab' });

    expect([wrongType.statusCode, wrongSize.statusCode, otherKey.statusCode, noIfNoneMatch.statusCode, unsigned.statusCode])
      .toEqual([403, 403, 403, 403, 403]);
    expect(await storage.exists('a.jpg', 'docs')).toBe(false);
  });

  it('rejects an expired URL', async () => {
    const signed = await createLocalStorageService().createUploadUrl('late.txt', 'docs', { contentType: 'text/plain', expiresIn: -1 });
    const res = await app.inject({ method: 'PUT', url: pathOf(signed.url), headers: signed.headers, payload: 'x' });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/expired/);
  });

  it('never serves the notification rules file', async () => {
    await addNotificationRule({ id: 'r', bucket: 'docs', events: ['created'], queue: 'q' });
    const res = await app.inject({ method: 'GET', url: '/__storage/notifications.metadata.json' });
    expect(res.statusCode).toBe(404);
  });

  it('creates a plain download URL', async () => {
    const signed = await createLocalStorageService().createDownloadUrl('dir/a b.pdf', 'docs');
    expect(signed).toMatchObject({ method: 'GET', url: 'http://localhost:3000/__storage/docs/dir/a%20b.pdf', headers: {} });
  });
});
