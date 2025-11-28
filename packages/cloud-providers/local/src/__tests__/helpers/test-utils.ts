import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

/**
 * Create a temporary directory for testing
 * @returns Path to the temporary directory
 */
export function createTempDir(): string {
  const tempDir = path.join(tmpdir(), `cloudnux-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Clean up a directory and all its contents
 * @param dirPath Path to the directory to clean up
 */
export function cleanupDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Wait for a specific amount of time
 * @param ms Milliseconds to wait
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random string
 * @param length Length of the string
 */
export function randomString(length = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Check if a file exists
 * @param filePath Path to the file
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Read file content as string
 * @param filePath Path to the file
 */
export function readFileContent(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Read file content as JSON
 * @param filePath Path to the file
 */
export function readJsonFile<T = any>(filePath: string): T {
  const content = readFileContent(filePath);
  return JSON.parse(content);
}
