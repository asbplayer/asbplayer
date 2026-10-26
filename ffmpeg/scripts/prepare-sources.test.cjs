/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { promisify } = require('node:util');

const exec = promisify(execFile);
let temporary;
let source;
let config;
beforeEach(async () => {
    temporary = await mkdtemp(join(tmpdir(), 'asbplayer-upstream-source-'));
    source = join(temporary, '.cache/sources/ffmpeg');
    await mkdir(join(temporary, 'scripts'));
    for (const script of ['lib.mjs', 'prepare-sources.mjs']) {
        await copyFile(join(__dirname, script), join(temporary, 'scripts', script));
    }
    // Fake only HTTP: every test stays offline, using a cached archive.
    await writeFile(
        join(temporary, 'offline.mjs'),
        "globalThis.fetch = async () => { throw new Error('Unexpected download'); };\n"
    );
    config = { ffmpeg: { source: { url: 'https://example.test/ffmpeg.tar.gz', sha256: 'a'.repeat(64) } } };
});
afterEach(async () => {
    await rm(temporary, { recursive: true, force: true });
});
const prepare = async () => {
    await writeFile(join(temporary, 'build-config.json'), JSON.stringify(config));
    return exec(process.execPath, [
        '--import',
        join(temporary, 'offline.mjs'),
        join(temporary, 'scripts/prepare-sources.mjs'),
    ]);
};

it('verifies a cached upstream archive and replaces stale extracted sources', async () => {
    const upstream = join(temporary, 'upstream');
    await mkdir(upstream);
    await writeFile(join(upstream, 'avutil.c'), 'verified source');
    await mkdir(join(temporary, '.cache/archives'), { recursive: true });
    const archive = join(temporary, '.cache/archives/ffmpeg.tar.gz');
    await exec('tar', ['-czf', archive, '-C', temporary, 'upstream']);
    config.ffmpeg.source.sha256 = createHash('sha256')
        .update(await readFile(archive))
        .digest('hex');
    await mkdir(source, { recursive: true });
    await writeFile(join(source, 'avutil.c'), 'stale source');
    await writeFile(join(source, 'obsolete.c'), 'obsolete source');
    await prepare();
    expect(await readFile(join(source, 'avutil.c'), 'utf8')).toBe('verified source');
    await expect(readFile(join(source, 'obsolete.c'))).rejects.toMatchObject({ code: 'ENOENT' });
});

it('does not extract an invalid cached archive over working sources', async () => {
    await mkdir(join(temporary, '.cache/archives'), { recursive: true });
    await writeFile(join(temporary, '.cache/archives/ffmpeg.tar.gz'), 'corrupt archive');
    await mkdir(source, { recursive: true });
    await writeFile(join(source, 'avutil.c'), 'working source');
    await expect(prepare()).rejects.toThrow('Unexpected download');
    expect(await readFile(join(source, 'avutil.c'), 'utf8')).toBe('working source');
});
