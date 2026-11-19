import { randomBytes } from 'node:crypto';
import { RestError } from '@azure/storage-blob';
import { afterAll, describe, expect, it } from 'vitest';

import { createBlobServiceClient, createStorageService } from '../../services/storage';
import { liveEnv, RUN_ID } from './helpers';

const account = liveEnv.storageAccount!;
const container = liveEnv.storageContainer;

describe.skipIf(!liveEnv.storageAccount)('live: storage (Blob Storage)', () => {
    const storage = createStorageService();
    const raw = () => createBlobServiceClient(account).getContainerClient(container);

    // Everything goes under <container>/live/<run id>/ and is removed afterwards.
    const prefix = `live/${RUN_ID}`;
    const written: string[] = [];
    const pathOf = (name: string) => `${container}/${prefix}/${name}`;
    async function write(name: string, data: Buffer | string, options?: Parameters<typeof storage.write>[3]) {
        const path = pathOf(name);
        written.push(path);
        return storage.write(path, data, account, options);
    }

    afterAll(async () => {
        await Promise.all(written.map(path => storage.delete(path, account)));
    });

    it('round-trips a 2 MB binary payload', async () => {
        const data = randomBytes(2 * 1024 * 1024);
        await write('bin/payload.bin', data);
        const back = await storage.read(pathOf('bin/payload.bin'), account);
        expect(back.length).toBe(data.length);
        expect(back.equals(data)).toBe(true);
    });

    it('stores content type and sanitized metadata keys (real Azure rejects "-" in keys)', async () => {
        await write('meta/doc.json', '{"a":1}', {
            contentType: 'application/json',
            metadata: { 'content-owner': 'mina', 'x.trace': 'abc', plain: 'yes' },
        });
        const props = await raw().getBlobClient(`${prefix}/meta/doc.json`).getProperties();
        expect(props.contentType).toBe('application/json');
        expect(props.metadata).toEqual({ content_owner: 'mina', x_trace: 'abc', plain: 'yes' });
    });

    it('handles keys with spaces, # and non-ASCII; encodedKey matches the real blob URL', async () => {
        const result = await write('my folder/a #1 – å.txt', 'Hej');
        expect(result.bucket).toBe(account);
        expect(result.key).toBe(pathOf('my folder/a #1 – å.txt'));

        expect(await storage.exists(result.key, account)).toBe(true);
        expect((await storage.read(result.key, account)).toString('utf-8')).toBe('Hej');

        const service = createBlobServiceClient(account);
        const blobUrl = service.getContainerClient(container).getBlobClient(`${prefix}/my folder/a #1 – å.txt`).url;
        expect(blobUrl).toBe(`${service.url.replace(/\/$/, '')}/${result.encodedKey}`);
    });

    it('overwrites an existing blob', async () => {
        await write('over/write.txt', 'first');
        await write('over/write.txt', 'second');
        expect((await storage.read(pathOf('over/write.txt'), account)).toString()).toBe('second');
    });

    it('missing blob: exists() is false, read() rejects with 404, delete() resolves', async () => {
        const missing = pathOf('nope/missing.txt');
        expect(await storage.exists(missing, account)).toBe(false);
        const error = await storage.read(missing, account).catch(e => e);
        expect(error).toBeInstanceOf(RestError);
        expect((error as RestError).statusCode).toBe(404);
        await expect(storage.delete(missing, account)).resolves.toBeUndefined();
    });

    it('delete() removes the blob', async () => {
        await write('del/me.txt', 'bye');
        await storage.delete(pathOf('del/me.txt'), account);
        expect(await storage.exists(pathOf('del/me.txt'), account)).toBe(false);
    });
});
