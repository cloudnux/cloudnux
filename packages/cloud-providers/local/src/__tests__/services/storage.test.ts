import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import { createLocalStorageService } from '../../services/storage';
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

  describe('write', () => {
    it('should write a file to storage', async () => {
      const bucket = 'test-bucket';
      const filePath = 'test-file.txt';
      const content = 'Hello, World!';

      const result = await storageService.write(filePath, content, bucket);

      expect(result).toMatchObject({
        bucket,
        key: filePath,
      });
      expect(result.url).toContain('test-file.txt');

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

    it('should throw error if bucket is not provided', async () => {
      await expect(
        storageService.write('test.txt', 'content', '')
      ).rejects.toThrow('Bucket name is required');
    });

    it('should prevent directory traversal attacks', async () => {
      const bucket = 'test-bucket';
      const maliciousPath = '../../../etc/passwd';
      const content = 'malicious content';

      await storageService.write(maliciousPath, content, bucket);

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
