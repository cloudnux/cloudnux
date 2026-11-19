import { spawn, ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';

// Well-known Azurite dev account key (public, documented by Microsoft; not a secret).
const AZURITE_ACCOUNT = 'devstoreaccount1';
const AZURITE_KEY = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

let azurite: ChildProcess | undefined;

function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address() as net.AddressInfo;
            server.close(() => resolve(port));
        });
    });
}

function waitForPort(port: number, timeoutMs = 15000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const attempt = () => {
            const socket = net.connect(port, '127.0.0.1');
            socket.once('connect', () => { socket.end(); resolve(); });
            socket.once('error', () => {
                socket.destroy();
                if (Date.now() > deadline) reject(new Error(`Azurite did not start on port ${port}`));
                else setTimeout(attempt, 150);
            });
        };
        attempt();
    });
}

export async function setup() {
    // An externally provided Azurite / real account wins (e.g. a CI service container).
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) return;

    const port = await freePort();
    const require = createRequire(import.meta.url);
    const azuriteBlob = path.join(path.dirname(require.resolve('azurite/package.json')), 'dist/src/blob/main.js');

    azurite = spawn(process.execPath, [
        azuriteBlob,
        '--blobHost', '127.0.0.1',
        '--blobPort', String(port),
        '--inMemoryPersistence',
        '--skipApiVersionCheck',
        '--silent',
    ], { stdio: 'ignore' });

    await waitForPort(port);

    process.env.AZURE_STORAGE_CONNECTION_STRING =
        `DefaultEndpointsProtocol=http;AccountName=${AZURITE_ACCOUNT};AccountKey=${AZURITE_KEY};` +
        `BlobEndpoint=http://127.0.0.1:${port}/${AZURITE_ACCOUNT};`;
}

export async function teardown() {
    azurite?.kill();
}
