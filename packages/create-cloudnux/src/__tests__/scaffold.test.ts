import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scaffoldProject } from '../scaffold.js';

const createdDirs: string[] = [];

async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), 'create-cloudnux-'));
    createdDirs.push(dir);
    return dir;
}

afterEach(async () => {
    await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('scaffoldProject', () => {
    it('writes the expected project files', async () => {
        const targetDir = await createTempDir();

        await scaffoldProject({
            targetDir,
            projectName: 'my-app',
            provider: 'aws',
            moduleDir: 'core'
        });

        const rootPackageJson = JSON.parse(await readFile(path.join(targetDir, 'package.json'), 'utf8'));
        expect(rootPackageJson.name).toBe('my-app');
        expect(rootPackageJson.workspaces).toEqual(['packages/modules/*']);
        expect(rootPackageJson.scripts.develop).toBe('nux develop');
        expect(rootPackageJson.scripts.build).toBe('nux production');
        expect(rootPackageJson.scripts.core).toBe('yarn workspace @my-app/core');
        expect(rootPackageJson.dependencies).toBeUndefined();
        expect(rootPackageJson.devDependencies['@cloudnux/cli']).toBeDefined();
        expect(rootPackageJson.devDependencies['@cloudnux/dev-console']).toBeDefined();
        expect(rootPackageJson.devDependencies['@cloudnux/local-cloud-provider']).toBeDefined();
        expect(rootPackageJson.devDependencies['typescript']).toBeDefined();

        const nuxConfig = await readFile(path.join(targetDir, 'nux.config.js'), 'utf8');
        expect(nuxConfig).toContain('"cloudProvider": "aws"');

        const rootTsconfig = JSON.parse(await readFile(path.join(targetDir, 'tsconfig.json'), 'utf8'));
        expect(rootTsconfig.include).toEqual(['packages']);
        expect(rootTsconfig.compilerOptions.target).toBe('es2022');
        expect(rootTsconfig.compilerOptions.types).toEqual(['node']);

        await expect(readFile(path.join(targetDir, '.gitignore'), 'utf8')).resolves.toContain('node_modules');

        const moduleDir = path.join(targetDir, 'packages', 'modules', 'core');
        const modulePackageJson = JSON.parse(await readFile(path.join(moduleDir, 'package.json'), 'utf8'));
        expect(modulePackageJson.name).toBe('@my-app/core');
        expect(modulePackageJson.main).toBe('src/index.ts');
        expect(modulePackageJson.private).toBe(true);
        expect(modulePackageJson.dependencies['@cloudnux/cloud-sdk']).toBeDefined();
        expect(modulePackageJson.dependencies['@cloudnux/core-cloud-provider']).toBeDefined();
        expect(modulePackageJson.dependencies['@cloudnux/aws-cloud-provider']).toBeDefined();

        const entrypoint = JSON.parse(await readFile(path.join(moduleDir, 'entrypoint.json'), 'utf8'));
        expect(entrypoint.entries.hello.trigger.type).toBe('http');

        const indexTs = await readFile(path.join(moduleDir, 'src', 'index.ts'), 'utf8');
        expect(indexTs).toContain("from \"@cloudnux/cloud-sdk\"");
        expect(indexTs).toContain('export function hello');
    });

    it('scaffolds a different project/module name, scoping the module under the project name', async () => {
        const targetDir = await createTempDir();

        await scaffoldProject({
            targetDir,
            projectName: 'other-app',
            provider: 'aws',
            moduleDir: 'identity'
        });

        const nuxConfig = await readFile(path.join(targetDir, 'nux.config.js'), 'utf8');
        expect(nuxConfig).toContain('"cloudProvider": "aws"');

        const moduleDir = path.join(targetDir, 'packages', 'modules', 'identity');
        await expect(readFile(path.join(moduleDir, 'package.json'), 'utf8')).resolves.toContain('"name": "@other-app/identity"');
    });
});
