/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { gunzipSync, gzipSync } = require('node:zlib');
const { unpackFfmpegRuntime } = require('@project/ffmpeg');

const version = '0.1.0';
const runtimeRoot = `asbplayer-ffmpeg-${version}-runtime`;
let root;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'asbplayer-runtime-archive-'));
    mkdirSync(join(root, runtimeRoot, 'notices'), { recursive: true });
    writeFileSync(join(root, runtimeRoot, 'ffmpeg-worker.js'), 'worker');
    writeFileSync(join(root, runtimeRoot, 'ffmpeg-core.js'), 'core');
    writeFileSync(join(root, runtimeRoot, 'ffmpeg-core.wasm'), Buffer.from([0, 97, 115, 109]));
    writeFileSync(join(root, runtimeRoot, 'notices/FFmpeg-LGPL-3.0.txt'), 'License');
});
afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

const pack = (format = 'ustar', entry = runtimeRoot) => {
    const archive = join(root, 'runtime.tar.gz');
    execFileSync('tar', [`--format=${format}`, '-czf', archive, '-C', root, entry]);
    return readFileSync(archive);
};
const tarBytes = (gzip) => new Uint8Array(gunzipSync(gzip));

it('unpacks the executables of the selected runtime version', async () => {
    const runtime = await unpackFfmpegRuntime(new Blob([pack()]), version);
    expect(await runtime.worker.text()).toBe('worker');
    expect(await runtime.core.text()).toBe('core');
    expect([...new Uint8Array(await runtime.wasm.arrayBuffer())]).toEqual([0, 97, 115, 109]);
    expect(runtime.wasm.type).toBe('application/wasm');
});

it('reads executable payloads across multiple blocks and nested archive entries', async () => {
    const large = 'x'.repeat(1300);
    writeFileSync(join(root, runtimeRoot, 'ffmpeg-core.js'), large);
    const runtime = await unpackFfmpegRuntime(new Blob([pack()]), version);
    expect(await runtime.core.text()).toBe(large);
    expect(await runtime.worker.text()).toBe('worker');
    expect([...new Uint8Array(await runtime.wasm.arrayBuffer())]).toEqual([0, 97, 115, 109]);
});

it('extracts executable paths stored with the ustar prefix field', async () => {
    const longVersion = `0.${'1'.repeat(60)}.0`;
    const longRoot = `asbplayer-ffmpeg-${longVersion}-runtime`;
    renameSync(join(root, runtimeRoot), join(root, longRoot));
    const runtime = await unpackFfmpegRuntime(new Blob([pack('ustar', longRoot)]), longVersion);
    expect(await runtime.worker.text()).toBe('worker');
    expect(await runtime.core.text()).toBe('core');
});

it('rejects an archive for a different runtime version', async () => {
    await expect(unpackFfmpegRuntime(new Blob([pack()]), '0.2.0')).rejects.toThrow('missing ffmpeg-worker.js');
});

it('rejects the old version-only archive root', async () => {
    renameSync(join(root, runtimeRoot), join(root, version));
    await expect(unpackFfmpegRuntime(new Blob([pack('ustar', version)]), version)).rejects.toThrow(
        'missing ffmpeg-worker.js'
    );
});

it.each(['ffmpeg-worker.js', 'ffmpeg-core.js', 'ffmpeg-core.wasm'])(
    'rejects a runtime missing %s',
    async (filename) => {
        rmSync(join(root, runtimeRoot, filename));
        await expect(unpackFfmpegRuntime(new Blob([pack()]), version)).rejects.toThrow(`missing ${filename}`);
    }
);

it('rejects links instead of following them', async () => {
    symlinkSync('ffmpeg-core.js', join(root, runtimeRoot, 'link'));
    await expect(unpackFfmpegRuntime(new Blob([pack()]), version)).rejects.toThrow(
        `Unsupported FFmpeg runtime archive entry: ${runtimeRoot}/link`
    );
});

it('rejects extension headers that the pinned ustar format never produces', async () => {
    await expect(unpackFfmpegRuntime(new Blob([pack('pax')]), version)).rejects.toThrow(
        'Unsupported FFmpeg runtime archive entry'
    );
});

it('rejects corrupt headers and truncated archives even when gzip is intact', async () => {
    const tar = tarBytes(pack());
    const corrupt = tar.slice();
    corrupt[0] ^= 1;
    await expect(unpackFfmpegRuntime(new Blob([gzipSync(corrupt)]), version)).rejects.toThrow(
        'Invalid FFmpeg runtime archive header'
    );
    for (const length of [700, 512 * 3]) {
        await expect(unpackFfmpegRuntime(new Blob([gzipSync(tar.slice(0, length))]), version)).rejects.toThrow(
            'truncated'
        );
    }
});

it('rejects data that is not gzip', async () => {
    await expect(unpackFfmpegRuntime(new Blob(['not an archive']), version)).rejects.toThrow();
});
