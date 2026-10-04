import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProviderKey } from './providers.js';
import {
    gitignore,
    moduleEntrypointJson,
    moduleIndexTs,
    modulePackageJson,
    nuxConfigJs,
    rootPackageJson,
    rootTsconfigJson
} from './templates.js';

export interface ScaffoldOptions {
    targetDir: string;
    projectName: string;
    provider: ProviderKey;
    moduleDir: string;
}

async function writeFileEnsuringDir(filePath: string, contents: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents, 'utf8');
}

export async function scaffoldProject(options: ScaffoldOptions): Promise<void> {
    const { targetDir, projectName, provider, moduleDir } = options;

    await writeFileEnsuringDir(path.join(targetDir, 'package.json'), rootPackageJson(projectName, [moduleDir]));
    await writeFileEnsuringDir(path.join(targetDir, 'nux.config.js'), nuxConfigJs(provider));
    await writeFileEnsuringDir(path.join(targetDir, 'tsconfig.json'), rootTsconfigJson());
    await writeFileEnsuringDir(path.join(targetDir, '.gitignore'), gitignore());

    const moduleDirPath = path.join(targetDir, 'packages', 'modules', moduleDir);
    await writeFileEnsuringDir(path.join(moduleDirPath, 'package.json'), modulePackageJson(projectName, moduleDir, provider));
    await writeFileEnsuringDir(path.join(moduleDirPath, 'entrypoint.json'), moduleEntrypointJson());
    await writeFileEnsuringDir(path.join(moduleDirPath, 'src', 'index.ts'), moduleIndexTs());
}
