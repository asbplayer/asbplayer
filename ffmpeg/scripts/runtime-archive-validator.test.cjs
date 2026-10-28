/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { mkdir, mkdtemp, readFile, rm, symlink, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { promisify } = require('node:util');
const { gunzipSync, gzipSync } = require('node:zlib');
const { verifyRuntimeArchive, verifySourcesArchive } = require('./runtime-archive-validator.cjs');

const exec = promisify(execFile);
let temporary;
let archive;

beforeEach(async () => {
    temporary = await mkdtemp(join(tmpdir(), 'asbplayer-archives-'));
    archive = join(temporary, 'runtime.tar.gz');
    await mkdir(join(temporary, '0.1.0/notices'), { recursive: true });
    await writeFile(join(temporary, '0.1.0/ffmpeg-core.wasm'), 'WASM');
    await writeFile(join(temporary, '0.1.0/notices/FFmpeg-LGPL-2.1.txt'), 'License');
});
afterEach(async () => {
    await rm(temporary, { recursive: true, force: true });
});
const pack = (...entries) => exec('tar', ['-czf', archive, '-C', temporary, ...entries]);

it('accepts only the selected runtime directory', async () => {
    await pack('0.1.0');
    await expect(verifyRuntimeArchive(archive, '0.1.0')).resolves.toContain('0.1.0/ffmpeg-core.wasm');
    await expect(verifyRuntimeArchive(archive, '0.2.0')).rejects.toThrow('unexpected root directory');
});

it('rejects symbolic links', async () => {
    await symlink('ffmpeg-core.wasm', join(temporary, '0.1.0/link'));
    await pack('0.1.0');
    await expect(verifyRuntimeArchive(archive, '0.1.0')).rejects.toThrow('link or special file');
});

it('rejects multiple roots', async () => {
    await writeFile(join(temporary, 'extra'), 'extra');
    await pack('0.1.0', 'extra');
    await expect(verifyRuntimeArchive(archive, '0.1.0')).rejects.toThrow('exactly one archive root');
});

it('rejects unsafe archive paths before extraction', async () => {
    await exec('tar', ['--format=ustar', '-czf', archive, '-C', temporary, '0.1.0']);
    // Rewrite the first ustar entry and its checksum without GNU tar's --transform.
    const contents = gunzipSync(await readFile(archive));
    const header = contents.subarray(0, 512);
    header.fill(0, 0, 100);
    header.write('../0.1.0/');
    header.fill(0x20, 148, 156);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
    await writeFile(archive, gzipSync(contents));
    await expect(verifyRuntimeArchive(archive, '0.1.0')).rejects.toThrow('unsafe path');
});

it('accepts only the expected sources archive root', async () => {
    await mkdir(join(temporary, 'asbplayer-ffmpeg-0.1.0-sources'));
    await writeFile(join(temporary, 'asbplayer-ffmpeg-0.1.0-sources/ffmpeg-9.0.2.tar.gz'), 'source');
    await pack('asbplayer-ffmpeg-0.1.0-sources');
    await expect(verifySourcesArchive(archive, 'asbplayer-ffmpeg-0.1.0-sources')).resolves.toContain(
        'asbplayer-ffmpeg-0.1.0-sources/ffmpeg-9.0.2.tar.gz'
    );
    await expect(verifySourcesArchive(archive, 'asbplayer-ffmpeg-0.2.0-sources')).rejects.toThrow(
        'Sources archive has an unexpected root directory'
    );
});
