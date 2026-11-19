import { randomUUID } from 'node:crypto';
import { BlobServiceClient, RestError } from '@azure/storage-blob';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createBlobServiceClient,
    createStorageService,
    resetAclWarning,
    resolveAccountUrl,
    sanitizeMetadataKey,
    splitPath,
} from '../../services/storage';
import { azureCloudProvider } from '../../index';

describe('sanitizeMetadataKey', () => {
    it.each([
        ['owner', 'owner'],
        ['content-owner', 'content_owner'],
        ['x.amz.meta', 'x_amz_meta'],
        ['1st-pass', '_1st_pass'],
        ['', '_'],
        ['already_valid_123', 'already_valid_123'],
    ])('%j -> %j', (input, expected) => {
        expect(sanitizeMetadataKey(input)).toBe(expected);
    });
});

describe('splitPath', () => {
    it.each([
        ['uploads/a.png', 'uploads', 'a.png'],
        ['uploads/2026/11/a.png', 'uploads', '2026/11/a.png'],
        ['/uploads/a.png', 'uploads', 'a.png'],
    ])('%j -> container %j, blob %j', (path, container, blobName) => {
        expect(splitPath(path)).toEqual({ container, blobName });
    });

    it.each(['a.png', 'uploads/', '/', ''])('rejects %j', (path) => {
        expect(() => splitPath(path)).toThrow(/expected "<container>\/<blob name>"/);
    });
});

describe('account resolution', () => {
    it('defaults to the public blob endpoint', () => {
        const saved = process.env.AZURE_STORAGE_BLOB_ENDPOINT;
        delete process.env.AZURE_STORAGE_BLOB_ENDPOINT;
        try {
            expect(resolveAccountUrl('mediaacct')).toBe('https://mediaacct.blob.core.windows.net');
        } finally {
            if (saved !== undefined) process.env.AZURE_STORAGE_BLOB_ENDPOINT = saved;
        }
    });

    it('uses AZURE_STORAGE_BLOB_ENDPOINT as a template', () => {
        process.env.AZURE_STORAGE_BLOB_ENDPOINT = 'http://127.0.0.1:10000/{account}';
        try {
            expect(resolveAccountUrl('acct2')).toBe('http://127.0.0.1:10000/acct2');
        } finally {
            delete process.env.AZURE_STORAGE_BLOB_ENDPOINT;
        }
    });

    it('uses the connection string only for its own account', () => {
        expect(createBlobServiceClient('devstoreaccount1').accountName).toBe('devstoreaccount1');
        expect(createBlobServiceClient('otheracct').url).toBe('https://otheracct.blob.core.windows.net/');
    });

    it('creates one client per account, lazily', async () => {
        const factory = vi.fn(createBlobServiceClient);
        const storage = createStorageService(factory);
        expect(factory).not.toHaveBeenCalled();
        await storage.exists('box1/a.txt', 'devstoreaccount1');
        await storage.exists('box2/b.txt', 'devstoreaccount1');
        expect(factory).toHaveBeenCalledTimes(1);
        expect(factory).toHaveBeenCalledWith('devstoreaccount1');
    });
});

describe('azure storage service (Azurite)', () => {
    const account = 'devstoreaccount1';
    const container = `cloudnux-test-${randomUUID().slice(0, 8)}`;
    const p = (blobName: string) => `${container}/${blobName}`;
    let raw: BlobServiceClient;
    const storage = createStorageService();

    beforeAll(async () => {
        raw = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!);
        await raw.getContainerClient(container).create();
    });

    afterAll(async () => {
        await raw.getContainerClient(container).deleteIfExists();
    });

    beforeEach(() => {
        resetAclWarning();
    });

    it('round-trips a Buffer', async () => {
        const data = Buffer.from([0, 1, 2, 250, 255]);
        await storage.write(p('bin/data.bin'), data, account);
        expect(await storage.read(p('bin/data.bin'), account)).toEqual(data);
    });

    it('writes strings as UTF-8', async () => {
        await storage.write(p('text/hej.txt'), 'Hej Stockholm – åäö 🚗', account);
        expect((await storage.read(p('text/hej.txt'), account)).toString('utf-8')).toBe('Hej Stockholm – åäö 🚗');
    });

    it('stores the blob under the container from the path', async () => {
        await storage.write(p('folder/file.txt'), 'x', account);
        expect(await raw.getContainerClient(container).getBlobClient('folder/file.txt').exists()).toBe(true);
    });

    it('returns account, full path and per-segment encoded path', async () => {
        const result = await storage.write(p('my folder/a #1.png'), 'x', account);
        expect(result).toEqual({
            bucket: account,
            key: p('my folder/a #1.png'),
            encodedKey: `${container}/my%20folder/a%20%231.png`,
        });
        expect(await storage.exists(result.key, account)).toBe(true);
        expect((await storage.read(result.key, account)).toString()).toBe('x');
    });

    it('stores content type and sanitized metadata', async () => {
        await storage.write(p('meta/doc.json'), '{}', account, {
            contentType: 'application/json',
            metadata: { 'content-owner': 'mina', plain: 'yes' },
        });
        const props = await raw.getContainerClient(container).getBlobClient('meta/doc.json').getProperties();
        expect(props.contentType).toBe('application/json');
        expect(props.metadata).toEqual({ content_owner: 'mina', plain: 'yes' });
    });

    it('overwrites an existing blob', async () => {
        await storage.write(p('over/write.txt'), 'first', account);
        await storage.write(p('over/write.txt'), 'second', account);
        expect((await storage.read(p('over/write.txt'), account)).toString()).toBe('second');
    });

    it('exists() reports false for a missing blob', async () => {
        expect(await storage.exists(p('nope/missing.txt'), account)).toBe(false);
    });

    it('delete() removes the blob', async () => {
        await storage.write(p('del/me.txt'), 'bye', account);
        await storage.delete(p('del/me.txt'), account);
        expect(await storage.exists(p('del/me.txt'), account)).toBe(false);
    });

    it('delete() of a missing blob resolves, like S3', async () => {
        await expect(storage.delete(p('del/never-existed.txt'), account)).resolves.toBeUndefined();
    });

    it('read() of a missing blob rejects with a 404 RestError', async () => {
        const error = await storage.read(p('nope/missing.txt'), account).catch(e => e);
        expect(error).toBeInstanceOf(RestError);
        expect((error as RestError).statusCode).toBe(404);
    });

    it('write() to a missing container rejects (no auto-create)', async () => {
        await expect(storage.write(`missing-${randomUUID().slice(0, 8)}/a.txt`, 'x', account)).rejects.toBeInstanceOf(RestError);
    });

    it('rejects a path without a container', async () => {
        await expect(storage.read('a.txt', account)).rejects.toThrow(/expected "<container>\/<blob name>"/);
    });

    it('requires a bucket (account)', async () => {
        await expect(storage.read(p('a.txt'), '')).rejects.toThrow('storage account name');
        await expect(storage.write(p('a.txt'), 'x', '')).rejects.toThrow('storage account name');
        await expect(storage.delete(p('a.txt'), '')).rejects.toThrow('storage account name');
        await expect(storage.exists(p('a.txt'), '')).rejects.toThrow('storage account name');
    });

    it('ignores a public acl with a single warning and still writes', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        try {
            await storage.write(p('acl/one.txt'), '1', account, { acl: 'public-read' });
            await storage.write(p('acl/two.txt'), '2', account, { acl: 'public-read' });
            await storage.write(p('acl/three.txt'), '3', account, { acl: 'private' });
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][0]).toMatch(/ignored on Azure/);
            expect(await storage.exists(p('acl/two.txt'), account)).toBe(true);
        } finally {
            spy.mockRestore();
        }
    });
});

describe('azureCloudProvider', () => {
    it('creates the storage service', () => {
        expect(typeof azureCloudProvider.createStorageService().write).toBe('function');
    });

    it('throws a clear error for services that are not implemented yet', () => {
        expect(() => azureCloudProvider.createFunctionsService()).toThrow(/functions service is not implemented/);
    });
});
