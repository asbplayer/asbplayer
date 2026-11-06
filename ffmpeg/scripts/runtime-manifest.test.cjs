/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdtemp, rm, symlink, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { promisify } = require('node:util');

const exec = promisify(execFile);
const verifier = pathToFileURL(resolve(__dirname, 'runtime-manifest.mjs')).href;
let root;
let manifest;
beforeEach(async () => {
    root = await mkdtemp(resolve(tmpdir(), 'asbplayer-runtime-manifest-'));
    manifest = {
        schemaVersion: 1,
        runtimeVersion: '0.1.0',
        ffmpeg: { version: '9.0.2', configuration: '--disable-all' },
        sources: [{ name: 'ffmpeg', url: 'https://example.test/ffmpeg.tar.gz', sha256: 'a'.repeat(64) }],
        runtime: [],
    };
});
afterEach(async () => {
    await rm(root, { recursive: true, force: true });
});

const addFile = async (filename, body = 'verified file') => {
    await writeFile(resolve(root, filename), body);
    manifest.runtime.push({
        filename,
        bytes: Buffer.byteLength(body),
        sha256: createHash('sha256').update(body).digest('hex'),
    });
};
const verify = () =>
    exec(process.execPath, [
        '--input-type=module',
        '-e',
        `import { verifyRuntimeManifest, verifyRuntimeDirectory } from ${JSON.stringify(verifier)};
        const manifest = ${JSON.stringify(manifest)};
        verifyRuntimeManifest(manifest, '0.1.0');
        await verifyRuntimeDirectory(${JSON.stringify(root)}, manifest);`,
    ]);

it.each([0, 1, 2])('verifies an exact inventory of %i files', async (count) => {
    for (let index = 0; index < count; index++) await addFile(`file-${index}.wasm`);
    await expect(verify()).resolves.toBeDefined();
});

it.each(['', '/absolute', '../outside', './file', 'nested//file', 'nested\\file', 'manifest.json'])(
    'rejects an unsafe manifest path %j',
    async (filename) => {
        manifest.runtime.push({ filename });
        await expect(verify()).rejects.toThrow('unsafe or duplicate file path');
    }
);

it('rejects duplicate manifest paths', async () => {
    await addFile('core.wasm');
    manifest.runtime.push({ ...manifest.runtime[0] });
    await expect(verify()).rejects.toThrow('unsafe or duplicate file path');
});

it.each(['missing', 'extra'])('rejects a directory with a %s file', async (kind) => {
    await addFile('core.wasm');
    if (kind === 'missing') await rm(resolve(root, 'core.wasm'));
    else await writeFile(resolve(root, 'extra.js'), 'unexpected');
    await expect(verify()).rejects.toThrow('inventory is incomplete');
});

it('rejects changed bytes even when the file size matches', async () => {
    await addFile('core.wasm', 'original');
    await writeFile(resolve(root, 'core.wasm'), 'modified');
    await expect(verify()).rejects.toThrow('hash or size mismatch');
});

it('rejects a symlink even when its target matches the declared hash and size', async () => {
    await addFile('core.wasm');
    await symlink('core.wasm', resolve(root, 'linked.wasm'));
    manifest.runtime.push({ ...manifest.runtime[0], filename: 'linked.wasm' });
    await expect(verify()).rejects.toThrow('hash or size mismatch');
});

it('rejects a manifest for a different runtime version', async () => {
    manifest.runtimeVersion = '0.2.0';
    await expect(verify()).rejects.toThrow('invalid identity or inventory');
});
