import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { createLocalStorageService, listStorageBuckets, listStorageObjects } from '../../services/storage';
import { createTempDir, cleanupDir, fileExists, readFileContent, readJsonFile } from '../helpers/test-utils';

describe('LocalStorageService', () => {
  let tempDir: string;
  let storageService: ReturnType<typeof createLocalStorageService>;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = createTempDir();
    process.env.DEV_CLOUD_STORAGE_BUCKET = tempDir;
    storageService = createLocalStorageService();
  });

  afterEach(() => {
    // Clean up temporary directory after each test
    cleanupDir(tempDir);
    delete process.env.DEV_CLOUD_STORAGE_BUCKET;
  });

  describe('configuration', () => {
    it('should throw when DEV_CLOUD_STORAGE_BUCKET is not set', () => {
      delete process.env.DEV_CLOUD_STORAGE_BUCKET;
      expect(() => createLocalStorageService()).toThrow('DEV_CLOUD_STORAGE_BUCKET is not set');
    });

    it('should throw when DEV_CLOUD_STORAGE_BUCKET is relative', () => {
      process.env.DEV_CLOUD_STORAGE_BUCKET = '.local-storage';
      expect(() => createLocalStorageService()).toThrow('must be an absolute path');
    });
  });

  describe('write', () => {
    it('should write a file to storage', async () => {
      const bucket = 'test-bucket';
      const filePath = 'test-file.txt';
      const content = 'Hello, World!';

      const result = await storageService.write(filePath, content, bucket);

      expect(result).toEqual({
        bucket,
        key: filePath,
        encodedKey: filePath,
      });
      expect(result).not.toHaveProperty('url');

      // Verify file exists
      const fullPath = path.join(tempDir, bucket, filePath);
      expect(fileExists(fullPath)).toBe(true);
      expect(readFileContent(fullPath)).toBe(content);
    });

    it('should write a file with Buffer data', async () => {
      const bucket = 'test-bucket';
      const filePath = 'binary-file.bin';
      const content = Buffer.from([1, 2, 3, 4, 5]);

      const result = await storageService.write(filePath, content, bucket);

      expect(result.bucket).toBe(bucket);
      expect(result.key).toBe(filePath);

      // Verify file exists and content matches
      const fullPath = path.join(tempDir, bucket, filePath);
      expect(fileExists(fullPath)).toBe(true);
    });

    it('should write a file with metadata', async () => {
      const bucket = 'test-bucket';
      const filePath = 'test-file.txt';
      const content = 'Hello, World!';
      const options = {
        contentType: 'text/plain',
        acl: 'public-read' as const,
        metadata: {
          author: 'Test User',
          version: '1.0',
        },
      };

      await storageService.write(filePath, content, bucket, options);

      // Verify metadata file exists
      const fullPath = path.join(tempDir, bucket, filePath);
      const metadataPath = `${fullPath}.metadata.json`;
      expect(fileExists(metadataPath)).toBe(true);

      // Verify metadata content
      const metadata = readJsonFile(metadataPath);
      expect(metadata.contentType).toBe(options.contentType);
      expect(metadata.acl).toBe(options.acl);
      expect(metadata.metadata).toEqual(options.metadata);
      expect(metadata.createdAt).toBeDefined();
      expect(metadata.updatedAt).toBeDefined();
    });

    it('should create nested directories automatically', async () => {
      const bucket = 'test-bucket';
      const filePath = 'nested/path/to/file.txt';
      const content = 'Nested file';

      await storageService.write(filePath, content, bucket);

      const fullPath = path.join(tempDir, bucket, filePath);
      expect(fileExists(fullPath)).toBe(true);
      expect(readFileContent(fullPath)).toBe(content);
    });

    it('should return the raw key and the key encoded per path segment', async () => {
      const result = await storageService.write('my folder/sub dir/photo #1.png', 'x', 'test-bucket');

      expect(result.key).toBe('my folder/sub dir/photo #1.png');
      expect(result.encodedKey).toBe('my%20folder/sub%20dir/photo%20%231.png');
      expect(fileExists(path.join(tempDir, 'test-bucket', 'my folder', 'sub dir', 'photo #1.png'))).toBe(true);
    });

    it('should strip ./ segments from the returned key', async () => {
      const result = await storageService.write('./a/./b/../c.txt', 'x', 'test-bucket');
      expect(result.key).toBe('a/c.txt');
    });

    it('should round-trip the returned key through read and delete', async () => {
      const { key, bucket } = await storageService.write('my folder/a #1.txt', 'round trip', 'test-bucket');

      expect((await storageService.read(key, bucket)).toString()).toBe('round trip');
      await storageService.delete(key, bucket);
      await expect(storageService.read(key, bucket)).rejects.toThrow('File not found');
    });

    it('should throw error if bucket is not provided', async () => {
      await expect(
        storageService.write('test.txt', 'content', '')
      ).rejects.toThrow('Bucket name is required');
    });

    it('should reject bucket names that escape the storage directory', async () => {
      await expect(storageService.write('a.txt', 'x', '..')).rejects.toThrow('Invalid bucket name');
      await expect(storageService.write('a.txt', 'x', 'a/b')).rejects.toThrow('Invalid bucket name');
    });

    it('should prevent directory traversal attacks', async () => {
      const bucket = 'test-bucket';
      const maliciousPath = '../../../etc/passwd';
      const content = 'malicious content';

      const result = await storageService.write(maliciousPath, content, bucket);
      expect(result.key).toBe('etc/passwd');
      expect(result.encodedKey).toBe('etc/passwd');

      // Should normalize the path and keep it within the bucket
      const fullPath = path.join(tempDir, bucket, 'etc', 'passwd');
      expect(fileExists(fullPath)).toBe(true);

      // Should NOT write outside the temp directory
      expect(fullPath.startsWith(tempDir)).toBe(true);
    });
  });

  describe('read', () => {
    it('should read a file from storage', async () => {
      const bucket = 'test-bucket';
      const filePath = 'test-file.txt';
      const content = 'Hello, World!';

      // Write file first
      await storageService.write(filePath, content, bucket);

      // Read the file
      const data = await storageService.read(filePath, bucket);

      expect(data.toString()).toBe(content);
    });

    it('should read binary data', async () => {
      const bucket = 'test-bucket';
      const filePath = 'binary.bin';
      const content = Buffer.from([1, 2, 3, 4, 5]);

      await storageService.write(filePath, content, bucket);
      const data = await storageService.read(filePath, bucket);

      expect(Buffer.isBuffer(data)).toBe(true);
      expect(data).toEqual(content);
    });

    it('should throw error if file does not exist', async () => {
      const bucket = 'test-bucket';
      const filePath = 'non-existent.txt';

      await expect(
        storageService.read(filePath, bucket)
      ).rejects.toThrow('File not found');
    });

    it('should throw error if bucket is not provided', async () => {
      await expect(
        storageService.read('test.txt', '')
      ).rejects.toThrow('Bucket name is required');
    });
  });

  describe('delete', () => {
    it('should delete a file from storage', async () => {
      const bucket = 'test-bucket';
      const filePath = 'test-file.txt';
      const content = 'Hello, World!';

      // Write file first
      await storageService.write(filePath, content, bucket);
      const fullPath = path.join(tempDir, bucket, filePath);
      expect(fileExists(fullPath)).toBe(true);

      // Delete the file
      await storageService.delete(filePath, bucket);

      // Verify file is deleted
      expect(fileExists(fullPath)).toBe(false);
    });

    it('should delete file and its metadata', async () => {
      const bucket = 'test-bucket';
      const filePath = 'test-file.txt';
      const content = 'Hello, World!';
      const options = {
        contentType: 'text/plain',
        metadata: { author: 'Test' },
      };

      // Write file with metadata
      await storageService.write(filePath, content, bucket, options);

      const fullPath = path.join(tempDir, bucket, filePath);
      const metadataPath = `${fullPath}.metadata.json`;
      expect(fileExists(fullPath)).toBe(true);
      expect(fileExists(metadataPath)).toBe(true);

      // Delete the file
      await storageService.delete(filePath, bucket);

      // Verify both file and metadata are deleted
      expect(fileExists(fullPath)).toBe(false);
      expect(fileExists(metadataPath)).toBe(false);
    });

    it('should throw error if file does not exist', async () => {
      const bucket = 'test-bucket';
      const filePath = 'non-existent.txt';

      await expect(
        storageService.delete(filePath, bucket)
      ).rejects.toThrow('File not found');
    });

    it('should throw error if bucket is not provided', async () => {
      await expect(
        storageService.delete('test.txt', '')
      ).rejects.toThrow('Bucket name is required');
    });
  });

  describe('exists', () => {
    it('should return true for an existing file', async () => {
      await storageService.write('dir/test.txt', 'hi', 'test-bucket');
      expect(await storageService.exists('dir/test.txt', 'test-bucket')).toBe(true);
    });

    it('should return false for a missing file', async () => {
      await storageService.write('test.txt', 'hi', 'test-bucket');
      expect(await storageService.exists('missing.txt', 'test-bucket')).toBe(false);
    });

    it('should return false for a directory prefix', async () => {
      await storageService.write('dir/test.txt', 'hi', 'test-bucket');
      expect(await storageService.exists('dir', 'test-bucket')).toBe(false);
    });

    it('should return false after delete', async () => {
      await storageService.write('test.txt', 'hi', 'test-bucket');
      await storageService.delete('test.txt', 'test-bucket');
      expect(await storageService.exists('test.txt', 'test-bucket')).toBe(false);
    });

    it('should throw for an empty bucket name', async () => {
      await expect(storageService.exists('test.txt', '')).rejects.toThrow('Bucket name is required');
    });
  });

  describe('dev console listing', () => {
    it('should list buckets and nested objects without metadata sidecars', async () => {
      await storageService.write('a/b/c.txt', 'abc', 'bucket-1', { contentType: 'text/plain' });
      await storageService.write('root file.txt', 'r', 'bucket-1');
      await storageService.write('x.txt', 'x', 'bucket-2');

      expect(await listStorageBuckets()).toEqual([{ name: 'bucket-1' }, { name: 'bucket-2' }]);

      const objects = await listStorageObjects('bucket-1');
      expect(objects!.map(o => o.key)).toEqual(['a/b/c.txt', 'root file.txt']);
      expect(objects![0]).toMatchObject({ encodedKey: 'a/b/c.txt', size: 3, contentType: 'text/plain' });
      expect(objects![1].encodedKey).toBe('root%20file.txt');
    });

    it('should return undefined for a missing bucket', async () => {
      expect(await listStorageObjects('nope')).toBeUndefined();
    });
  });

  describe('integration tests', () => {
    it('should handle multiple files in the same bucket', async () => {
      const bucket = 'multi-file-bucket';
      const files = [
        { path: 'file1.txt', content: 'Content 1' },
        { path: 'file2.txt', content: 'Content 2' },
        { path: 'nested/file3.txt', content: 'Content 3' },
      ];

      // Write all files
      for (const file of files) {
        await storageService.write(file.path, file.content, bucket);
      }

      // Read all files
      for (const file of files) {
        const data = await storageService.read(file.path, bucket);
        expect(data.toString()).toBe(file.content);
      }

      // Delete all files
      for (const file of files) {
        await storageService.delete(file.path, bucket);
      }

      // Verify all deleted
      for (const file of files) {
        await expect(
          storageService.read(file.path, bucket)
        ).rejects.toThrow('File not found');
      }
    });

    it('should handle different buckets independently', async () => {
      const bucket1 = 'bucket-1';
      const bucket2 = 'bucket-2';
      const filePath = 'same-name.txt';

      await storageService.write(filePath, 'Content in bucket 1', bucket1);
      await storageService.write(filePath, 'Content in bucket 2', bucket2);

      const data1 = await storageService.read(filePath, bucket1);
      const data2 = await storageService.read(filePath, bucket2);

      expect(data1.toString()).toBe('Content in bucket 1');
      expect(data2.toString()).toBe('Content in bucket 2');
    });

    it('should overwrite existing files', async () => {
      const bucket = 'test-bucket';
      const filePath = 'overwrite.txt';

      await storageService.write(filePath, 'Original content', bucket);
      await storageService.write(filePath, 'New content', bucket);

      const data = await storageService.read(filePath, bucket);
      expect(data.toString()).toBe('New content');
    });
  });
});
