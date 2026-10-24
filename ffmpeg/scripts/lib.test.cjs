/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdtemp, readFile, readdir, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { promisify } = require('node:util');

const exec = promisify(execFile);
const lib = pathToFileURL(resolve(__dirname, 'lib.mjs')).href;
let root;
beforeEach(async () => {
    root = await mkdtemp(resolve(tmpdir(), 'asbplayer-download-test-'));
});
afterEach(async () => {
    await rm(root, { recursive: true, force: true });
});
const run = (source) => exec(process.execPath, ['--input-type=module', '-e', source]);

it('allows overlapping downloads to the same destination and leaves only verified bytes', async () => {
    const destination = resolve(root, 'runtime.tar.gz');
    const body = 'verified runtime archive';
    const hash = createHash('sha256').update(body).digest('hex');
    const source = `import { download } from ${JSON.stringify(lib)};
        globalThis.fetch = async () => { await new Promise(resolve => setTimeout(resolve, 30)); return new Response(${JSON.stringify(body)}); };
        await download('https://example.test/runtime', ${JSON.stringify(destination)}, ${JSON.stringify(hash)});`;
    await Promise.all(Array.from({ length: 4 }, () => run(source)));
    expect(await readFile(destination, 'utf8')).toBe(body);
    expect(await readdir(root)).toEqual(['runtime.tar.gz']);
});

it('preserves an existing file and removes partial downloads on integrity failure', async () => {
    const destination = resolve(root, 'runtime.tar.gz');
    await writeFile(destination, 'existing runtime');
    await expect(
        run(`import { download } from ${JSON.stringify(lib)};
        globalThis.fetch = async () => new Response('corrupt');
        await download('https://example.test/runtime', ${JSON.stringify(destination)}, '${'a'.repeat(64)}');`)
    ).rejects.toThrow('SHA-256 mismatch');
    expect(await readFile(destination, 'utf8')).toBe('existing runtime');
    expect(await readdir(root)).toEqual(['runtime.tar.gz']);
});

it('serializes preparation across processes and releases the lock after failure', async () => {
    const counter = resolve(root, 'counter');
    const lock = resolve(root, 'preparation.lock');
    await writeFile(counter, '0');
    const source = `import { withFileLock } from ${JSON.stringify(lib)};
        import { readFile, writeFile } from 'node:fs/promises';
        await withFileLock(${JSON.stringify(lock)}, async () => {
            const value = Number(await readFile(${JSON.stringify(counter)}, 'utf8'));
            await new Promise(resolve => setTimeout(resolve, 30));
            await writeFile(${JSON.stringify(counter)}, String(value + 1));
        });`;
    await expect(
        run(`import { withFileLock } from ${JSON.stringify(lib)};
        await withFileLock(${JSON.stringify(lock)}, () => { throw new Error('Failed extraction'); });`)
    ).rejects.toThrow('Failed extraction');
    await Promise.all(Array.from({ length: 4 }, () => run(source)));
    expect(await readFile(counter, 'utf8')).toBe('4');
    expect(await readdir(root)).toEqual(['counter']);
});
