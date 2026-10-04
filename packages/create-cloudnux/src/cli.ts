import meow from 'meow';
import * as p from '@clack/prompts';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scaffoldProject } from './scaffold.js';
import { availableProviders, isAvailableProvider, PROVIDERS, type ProviderKey } from './providers.js';
import { slugify, validateProjectName } from './validate.js';

const cli = meow(`
    Usage
      $ create-cloudnux <project-directory> [options]

    Options
      --provider, -p   Cloud provider to use (${availableProviders().join(', ')})
      --install        Run yarn install after scaffolding (default: true)
      --no-install     Skip running yarn install

    Examples
      $ create-cloudnux my-app
      $ create-cloudnux my-app --provider=aws
`, {
    importMeta: import.meta,
    flags: {
        provider: { type: 'string', shortFlag: 'p' },
        install: { type: 'boolean', default: true }
    }
});

function runYarnInstall(cwd: string): Promise<number> {
    return new Promise((resolve) => {
        const child = spawn('yarn', ['install'], { cwd, stdio: 'ignore' });
        child.on('error', () => resolve(1));
        child.on('close', (code) => resolve(code ?? 1));
    });
}

async function main() {
    p.intro('create-cloudnux');

    // The project name is derived from the target directory's final path
    // segment, not the raw argument, so an absolute or nested path (e.g.
    // "/Users/me/projects/my-app" or "apps/my-app") still yields "my-app"
    // rather than the whole path getting slugified into the name.
    const nameFromArg = (value: string) => path.basename(path.resolve(process.cwd(), value));

    let targetArg = cli.input[0];
    if (!targetArg) {
        const response = await p.text({
            message: 'Project directory',
            placeholder: 'my-app',
            validate: (value) => validateProjectName(nameFromArg(value || ''))
        });
        if (p.isCancel(response)) {
            p.cancel('Cancelled.');
            process.exit(1);
        }
        targetArg = response;
    } else {
        const error = validateProjectName(nameFromArg(targetArg));
        if (error) {
            p.cancel(error);
            process.exit(1);
        }
    }

    const targetDir = path.resolve(process.cwd(), targetArg);
    const projectName = slugify(path.basename(targetDir));

    let provider: ProviderKey;
    if (cli.flags.provider) {
        if (!isAvailableProvider(cli.flags.provider)) {
            p.cancel(`Unknown or unavailable provider "${cli.flags.provider}". Available providers: ${availableProviders().join(', ')}`);
            process.exit(1);
        }
        provider = cli.flags.provider;
    } else {
        const choices = availableProviders();
        if (choices.length === 1) {
            provider = choices[0];
        } else {
            const response = await p.select({
                message: 'Which cloud provider will this project deploy to?',
                options: choices.map((key) => ({ value: key, label: PROVIDERS[key].label }))
            });
            if (p.isCancel(response)) {
                p.cancel('Cancelled.');
                process.exit(1);
            }
            provider = response as ProviderKey;
        }
    }

    // @cloudnux/cli generates `import <moduleDir>Entries from "./<moduleDir>"`
    // internally, so the module's directory name must be a valid JS
    // identifier (no hyphens). The module's package.json "name" still follows
    // the project's standard @<projectName>/<moduleDir> scoping convention.
    const moduleDir = 'core';

    const spinner = p.spinner();
    spinner.start('Creating project files');
    await scaffoldProject({ targetDir, projectName, provider, moduleDir });
    spinner.stop('Project files created');

    if (cli.flags.install) {
        const installSpinner = p.spinner();
        installSpinner.start('Installing dependencies with yarn (this can take a minute)');
        const exitCode = await runYarnInstall(targetDir);
        if (exitCode === 0) {
            installSpinner.stop('Dependencies installed');
        } else {
            installSpinner.stop('Could not run yarn install automatically');
        }
    }

    p.outro(`Done! Next steps:\n\n  cd ${targetArg}\n  ${cli.flags.install ? '' : 'yarn install\n  '}yarn develop`);
}

main().catch((error) => {
    p.cancel(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
