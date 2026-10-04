import { PROVIDERS, type ProviderKey } from './providers.js';

const CLI_VERSION_RANGE = '^0.20.0';
const SDK_VERSION_RANGE = '^0.20.0';
const CORE_PROVIDER_VERSION_RANGE = '^0.20.0';
const PROVIDER_PACKAGE_VERSION_RANGE = '^0.20.0';
const DEV_CONSOLE_VERSION_RANGE = '^0.20.0';
// @cloudnux/local-cloud-provider powers `nux develop`'s local emulator and is
// required regardless of which cloud the project targets for deployment.
const LOCAL_PROVIDER_VERSION_RANGE = '^0.20.0';
// @cloudnux/cli shells out to tsup to build/bundle the project, and tsup
// requires typescript as a peer dependency the consumer must provide. The
// root tsconfig's "ignoreDeprecations": "6.0" requires TypeScript 6.x.
const TYPESCRIPT_VERSION_RANGE = '^6.0.3';
const TYPES_NODE_VERSION_RANGE = '^25.3.1';

export function rootPackageJson(projectName: string, moduleDirs: string[]): string {
    const moduleScripts = Object.fromEntries(
        moduleDirs.map((moduleDir) => [moduleDir, `yarn workspace @${projectName}/${moduleDir}`])
    );

    return JSON.stringify(
        {
            name: projectName,
            version: '1.0.0',
            private: true,
            type: 'module',
            engines: {
                node: '>=22.0.0'
            },
            // Modules live under packages/modules/<name>, so the glob must
            // reach that depth or yarn never registers them as workspaces
            // (and never installs their dependencies).
            workspaces: ['packages/modules/*'],
            scripts: {
                develop: 'nux develop',
                build: 'nux production',
                ...moduleScripts
            },
            devDependencies: {
                '@cloudnux/cli': CLI_VERSION_RANGE,
                '@cloudnux/dev-console': DEV_CONSOLE_VERSION_RANGE,
                '@cloudnux/local-cloud-provider': LOCAL_PROVIDER_VERSION_RANGE,
                '@types/node': TYPES_NODE_VERSION_RANGE,
                'typescript': TYPESCRIPT_VERSION_RANGE
            }
        },
        null,
        4
    ) + '\n';
}

export function nuxConfigJs(provider: ProviderKey): string {
    return `export default {
    "cloudProvider": "${provider}",
    "modulesPath": "./packages/modules/**/entrypoint.json",
    "workingDir": "./.nux",
    "externalPackages": [],
    "environments": {
        "staging": {
            "tasks": []
        }
    }
}
`;
}

export function rootTsconfigJson(): string {
    return JSON.stringify(
        {
            compilerOptions: {
                incremental: true,
                target: 'es2022',
                module: 'commonjs',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                noImplicitAny: true,
                moduleResolution: 'node',
                sourceMap: true,
                resolveJsonModule: true,
                declaration: true,
                declarationMap: true,
                traceResolution: false,
                strictNullChecks: true,
                outDir: 'node_modules/dist',
                noEmit: true,
                ignoreDeprecations: '6.0',
                tsBuildInfoFile: './node_modules/dist/tsconfig.tsbuildinfo',
                // moduleResolution "node10" does not auto-activate @types/node's
                // ambient globals (Buffer, process, ...) without this; without it,
                // typechecking any @cloudnux/*-cloud-provider .d.ts that references
                // Buffer fails with TS2591.
                types: ['node']
            },
            include: ['packages']
        },
        null,
        4
    ) + '\n';
}

export function gitignore(): string {
    return `node_modules
.nux
.develop
dist
`;
}

export function modulePackageJson(projectName: string, moduleDir: string, provider: ProviderKey): string {
    return JSON.stringify(
        {
            name: `@${projectName}/${moduleDir}`,
            version: '1.0.0',
            main: 'src/index.ts',
            license: 'MIT',
            private: true,
            scripts: {
                typecheck: 'tsc --noEmit'
            },
            dependencies: {
                [PROVIDERS[provider].packageName]: PROVIDER_PACKAGE_VERSION_RANGE,
                '@cloudnux/cloud-sdk': SDK_VERSION_RANGE,
                '@cloudnux/core-cloud-provider': CORE_PROVIDER_VERSION_RANGE
            }
        },
        null,
        4
    ) + '\n';
}

export function moduleEntrypointJson(): string {
    return JSON.stringify(
        {
            entries: {
                hello: {
                    handler: 'hello',
                    trigger: {
                        type: 'http',
                        options: {
                            method: 'GET',
                            route: '/v1/hello'
                        }
                    }
                }
            }
        },
        null,
        4
    ) + '\n';
}

export function moduleIndexTs(): string {
    return `import { HttpFunctionContext } from "@cloudnux/cloud-sdk";

export function hello(ctx: HttpFunctionContext) {
    ctx.success({
        message: 'Hello from CloudNux!'
    });
}
`;
}
