/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFileSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { gunzipSync } = require('node:zlib');
const { readTarFiles, unpackFfmpegRuntime } = require('@project/ffmpeg');

let root;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'asbplayer-runtime-archive-'));
    mkdirSync(join(root, '0.1.0/notices'), { recursive: true });
    writeFileSync(join(root, '0.1.0/ffmpeg-worker.js'), 'worker');
    writeFileSync(join(root, '0.1.0/ffmpeg-core.js'), 'core');
    writeFileSync(join(root, '0.1.0/ffmpeg-core.wasm'), Buffer.from([0, 97, 115, 109]));
    writeFileSync(join(root, '0.1.0/notices/FFmpeg-LGPL-2.1.txt'), 'License');
});
afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

const pack = (format = 'ustar', entry = '0.1.0') => {
    const archive = join(root, 'runtime.tar.gz');
    execFileSync('tar', [`--format=${format}`, '-czf', archive, '-C', root, entry]);
    return readFileSync(archive);
};
const tarBytes = (gzip) => new Uint8Array(gunzipSync(gzip));

it('unpacks the executables of the selected runtime version', async () => {
    const runtime = await unpackFfmpegRuntime(new Blob([pack()]), '0.1.0');
    expect(await runtime.worker.text()).toBe('worker');
    expect(await runtime.core.text()).toBe('core');
    expect([...new Uint8Array(await runtime.wasm.arrayBuffer())]).toEqual([0, 97, 115, 109]);
    expect(runtime.wasm.type).toBe('application/wasm');
});

it('reads files across multiple blocks and nested directories', () => {
    const large = 'x'.repeat(1300);
    writeFileSync(join(root, '0.1.0/ffmpeg-core.js'), large);
    const files = readTarFiles(tarBytes(pack()));
    expect(new TextDecoder().decode(files.get('0.1.0/ffmpeg-core.js'))).toBe(large);
    expect(new TextDecoder().decode(files.get('0.1.0/notices/FFmpeg-LGPL-2.1.txt'))).toBe('License');
});

it('reads paths stored with the ustar prefix field', () => {
    const directory = `0.1.0/${'d'.repeat(90)}`;
    mkdirSync(join(root, directory));
    writeFileSync(join(root, directory, `${'f'.repeat(60)}.txt`), 'long path');
    const files = readTarFiles(tarBytes(pack()));
    expect(new TextDecoder().decode(files.get(`${directory}/${'f'.repeat(60)}.txt`))).toBe('long path');
});

it('rejects an archive for a different runtime version', async () => {
    await expect(unpackFfmpegRuntime(new Blob([pack()]), '0.2.0')).rejects.toThrow('missing ffmpeg-worker.js');
});

it('rejects links instead of following them', () => {
    symlinkSync('ffmpeg-core.js', join(root, '0.1.0/link'));
    expect(() => readTarFiles(tarBytes(pack()))).toThrow('Unsupported FFmpeg runtime archive entry: 0.1.0/link');
});

it('rejects extension headers that the pinned ustar format never produces', () => {
    expect(() => readTarFiles(tarBytes(pack('pax')))).toThrow('Unsupported FFmpeg runtime archive entry');
});

it('rejects corrupt headers and truncated archives', () => {
    const tar = tarBytes(pack());
    const corrupt = tar.slice();
    corrupt[0] ^= 1;
    expect(() => readTarFiles(corrupt)).toThrow('Invalid FFmpeg runtime archive header');
    expect(() => readTarFiles(tar.slice(0, 700))).toThrow('truncated');
    expect(() => readTarFiles(tar.slice(0, 512 * 3))).toThrow('truncated');
});

it('rejects data that is not gzip', async () => {
    await expect(unpackFfmpegRuntime(new Blob(['not an archive']), '0.1.0')).rejects.toThrow();
});
