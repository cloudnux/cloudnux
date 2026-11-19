import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Runs once before the live suite. Values set or removed on process.env here
// are inherited by the test workers.
//
//   .env.live            written by scripts/live-env.sh (git-ignored). Values
//                        already in the shell environment take precedence.
//   LIVE_AUTH=entra      drop the keys/connection strings so every service goes
//                        through DefaultAzureCredential (az login), the
//                        production path. Maps then needs AZURE_MAPS_CLIENT_ID.

const envFile = fileURLToPath(new URL('../../../.env.live', import.meta.url));

const KEY_VARS = [
    'AZURE_STORAGE_CONNECTION_STRING',
    'AZURE_SERVICEBUS_CONNECTION_STRING',
    'AZURE_MAPS_KEY',
    'AZURE_COMMUNICATION_CONNECTION_STRING',
];

export function setup() {
    if (existsSync(envFile)) {
        process.loadEnvFile(envFile);
    }

    const entra = process.env.LIVE_AUTH === 'entra';
    if (entra) {
        for (const name of KEY_VARS) delete process.env[name];
    }

    const env = process.env;
    const auth = (keyVar: string) => (env[keyVar] ? 'key / connection string' : 'DefaultAzureCredential');
    const line = (name: string, target: string | undefined, how: string) =>
        `  ${name.padEnd(13)} ${target ? `${target}  (${how})` : 'skipped: not configured'}\n`;

    process.stdout.write(
        `\nLive Azure tests${existsSync(envFile) ? ' (.env.live loaded)' : ''}${entra ? ', Entra ID only' : ''}\n` +
        line('storage', env.LIVE_STORAGE_ACCOUNT, auth('AZURE_STORAGE_CONNECTION_STRING')) +
        line('service bus', env.LIVE_SERVICEBUS_NAMESPACE, auth('AZURE_SERVICEBUS_CONNECTION_STRING')) +
        line('maps', env.AZURE_MAPS_KEY || env.AZURE_MAPS_CLIENT_ID ? 'atlas.microsoft.com' : undefined,
            env.AZURE_MAPS_KEY ? 'subscription key' : 'DefaultAzureCredential') +
        line('email', env.AZURE_COMMUNICATION_RESOURCE && env.LIVE_EMAIL_FROM,
            `${auth('AZURE_COMMUNICATION_CONNECTION_STRING')}, ${env.LIVE_EMAIL_TO ? `to ${env.LIVE_EMAIL_TO}` : 'LIVE_EMAIL_TO not set: send test skipped'}`) +
        '\n'
    );
}
