/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { promisify } = require('node:util');

const exec = promisify(execFile);
const version = '0.1.0';
const artifactPrefix = 'example-ffmpeg';
const tagPrefix = 'example-runtime-v';
const runtimeName = `${artifactPrefix}-${version}-runtime.tar.gz`;
const sourcesName = `${artifactPrefix}-${version}-sources.tar.gz`;
const sourcesRoot = `${artifactPrefix}-${version}-sources`;
const sources = [
    { name: 'ffmpeg', url: 'https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.gz', body: 'upstream FFmpeg source' },
    { name: 'opus', url: 'https://downloads.xiph.org/releases/opus/opus-1.6.1.tar.gz', body: 'upstream Opus source' },
];
const tarballName = (source) => source.url.split('/').pop();
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
let repositoryRoot;
let root;
let release;
let runtime;
let manifest;

const writeRuntimeArchive = () =>
    exec('tar', ['--format=ustar', '-czf', resolve(release, runtimeName), '-C', resolve(root, 'runtime'), version]);
/** Publish a sources archive holding the given tarball bodies, keyed by filename. */
const writeSourcesArchive = async (tarballs) => {
    const staging = resolve(root, 'sources-staging');
    await rm(staging, { recursive: true, force: true });
    await mkdir(resolve(staging, sourcesRoot), { recursive: true });
    for (const [filename, body] of Object.entries(tarballs)) {
        await writeFile(resolve(staging, sourcesRoot, filename), body);
    }
    await exec('tar', ['--format=ustar', '-czf', resolve(release, sourcesName), '-C', staging, sourcesRoot]);
};
const publishedSources = () => Object.fromEntries(sources.map((source) => [tarballName(source), source.body]));

beforeEach(async () => {
    repositoryRoot = await mkdtemp(resolve(tmpdir(), 'asbplayer-release-test-'));
    root = resolve(repositoryRoot, 'ffmpeg');
    release = resolve(root, 'published');
    await mkdir(resolve(root, 'scripts'), { recursive: true });
    await writeFile(
        resolve(repositoryRoot, 'project.json'),
        JSON.stringify({ artifacts: { ffmpeg: { version, prefix: artifactPrefix, tagPrefix } } })
    );
    await mkdir(release);
    for (const script of [
        'lib.mjs',
        'release-names.mjs',
        'release-info.mjs',
        'select-runtime.mjs',
        'fetch.mjs',
        'verify-artifacts.mjs',
        'runtime-archive-validator.cjs',
        'sources-archive.mjs',
    ]) {
        await copyFile(resolve(__dirname, script), resolve(root, 'scripts', script));
    }
    const inventory = JSON.parse(await readFile(resolve(__dirname, '../runtime-assets.json'), 'utf8'));
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ version: '9.9.9', type: 'module' }));
    await writeFile(resolve(root, 'artifact-lock.json'), '{}');
    const bodies = {
        'ffmpeg-worker.js': 'export {};',
        'ffmpeg-core.js': 'export const _asb_runtime_info_json = () => 0;',
        'ffmpeg-core.wasm': Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]),
        ...Object.fromEntries(inventory.notices.map((filename) => [`notices/${filename}`, `License: ${filename}`])),
    };
    runtime = resolve(root, 'runtime', version);
    for (const [filename, body] of Object.entries(bodies)) {
        await mkdir(resolve(runtime, filename, '..'), { recursive: true });
        await writeFile(resolve(runtime, filename), body);
    }
    await writeSourcesArchive(publishedSources());
    manifest = {
        schemaVersion: 1,
        runtimeVersion: version,
        ffmpeg: {
            version: '9.0.2',
            license: 'LGPL version 2.1 or later',
            configuration: '--disable-all --disable-autodetect --disable-pthreads',
        },
        license: { notices: inventory.notices.map((filename) => `notices/${filename}`) },
        sources: sources.map(({ name, url, body }) => ({ name, url, sha256: digest(body) })),
        limits: { maximumWasmBytes: 1000000 },
        runtime: Object.entries(bodies).map(([filename, body]) => ({
            filename,
            bytes: Buffer.byteLength(body),
            sha256: digest(body),
        })),
    };
    await writeFile(resolve(runtime, 'manifest.json'), JSON.stringify(manifest));
    await writeRuntimeArchive();
    // HTTP is the only fake boundary; selection/extraction/hash checks use actual files and processes.
    await writeFile(
        resolve(root, 'http.mjs'),
        `import { readFile, appendFile } from 'node:fs/promises';
        globalThis.fetch = async (url) => {
            await appendFile(${JSON.stringify(resolve(root, 'requests'))}, url + '\\n');
            await new Promise(resolve => setTimeout(resolve, 25));
            try {
                return new Response(await readFile(${JSON.stringify(release)} + '/' + new URL(url).pathname.split('/').pop()));
            } catch {
                return new Response('Not Found', { status: 404 });
            }
        };`
    );
});
afterEach(async () => {
    await rm(repositoryRoot, { recursive: true, force: true });
});

const run = (script, args = [], env = process.env) =>
    exec(process.execPath, ['--import', resolve(root, 'http.mjs'), resolve(root, 'scripts', script), ...args], { env });
const readLock = async () => readFile(resolve(root, 'artifact-lock.json'), 'utf8');

it('uses the project runtime version and naming independently of the package version', async () => {
    const { stdout } = await run('release-info.mjs');
    expect(stdout).toBe(
        `version=${version}\ntag=${tagPrefix}${version}\ntitle=${artifactPrefix}-v${version}\nruntimeArchive=${runtimeName}\nsourcesArchive=${sourcesName}\nsourcesRoot=${sourcesRoot}\n`
    );
    expect((await run('release-info.mjs', ['runtimeArchive'])).stdout).toBe(`${runtimeName}\n`);
});

it('selects a fork release, records the runtime archive, and accepts identical reselection', async () => {
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    const lock = JSON.parse(await readLock());
    const archive = await readFile(resolve(release, runtimeName));
    expect(lock).toEqual({
        schemaVersion: 1,
        runtimeVersion: version,
        ffmpegVersion: '9.0.2',
        releaseUrl: `https://github.com/example/fork/releases/tag/${tagPrefix}${version}`,
        releaseBaseDownloadUrl: `https://github.com/example/fork/releases/download/${tagPrefix}${version}`,
        runtimeArchive: { filename: runtimeName, sha256: digest(archive), bytes: archive.byteLength },
    });
    expect((await readFile(resolve(root, 'requests'), 'utf8')).split('\n').filter(Boolean)).toEqual([
        `https://github.com/example/fork/releases/download/${tagPrefix}${version}/${runtimeName}`,
        `https://github.com/example/fork/releases/download/${tagPrefix}${version}/${sourcesName}`,
    ]);
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    await expect(run('select-runtime.mjs', ['--repo', 'different/fork'])).rejects.toThrow('immutable');
});

it('uses the workflow repository when no CLI repository is supplied', async () => {
    await run('select-runtime.mjs', [], { ...process.env, GH_REPO: '', GITHUB_REPOSITORY: 'workflow/repo' });
    expect(JSON.parse(await readLock()).releaseUrl).toContain('workflow/repo');
});

it('keeps the selected runtime pinned when the project development version advances', async () => {
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    const lock = await readLock();
    await writeFile(
        resolve(repositoryRoot, 'project.json'),
        JSON.stringify({ artifacts: { ffmpeg: { version: '0.2.0', prefix: artifactPrefix, tagPrefix } } })
    );
    await run('fetch.mjs');
    await run('verify-artifacts.mjs');
    expect(await readLock()).toBe(lock);
    await copyFile(resolve(__dirname, '../build-config.json'), resolve(root, 'build-config.json'));
    await expect(run('verify-artifacts.mjs', ['--candidate'])).rejects.toThrow('FFmpeg 0.2.0 is not prepared');
});

it('keeps the frozen archive pinned when the project release naming changes', async () => {
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    await run('fetch.mjs');
    const lock = await readLock();
    await writeFile(
        resolve(repositoryRoot, 'project.json'),
        JSON.stringify({
            artifacts: { ffmpeg: { version, prefix: 'renamed-ffmpeg', tagPrefix: 'renamed-runtime-v' } },
        })
    );
    expect((await run('release-info.mjs', ['runtimeArchive'])).stdout).toBe(
        `renamed-ffmpeg-${version}-runtime.tar.gz\n`
    );
    expect((await run('verify-artifacts.mjs')).stdout).toContain(`Verified FFmpeg ${version} frozen runtime`);
    expect((await run('fetch.mjs')).stdout).toContain(`FFmpeg ${version} is already prepared`);

    await rm(resolve(root, 'dist'), { recursive: true, force: true });
    await rm(resolve(root, 'release'), { recursive: true, force: true });
    const requests = await readFile(resolve(root, 'requests'), 'utf8');
    await run('fetch.mjs');
    expect((await run('verify-artifacts.mjs')).stdout).toContain(`Verified FFmpeg ${version} frozen runtime`);
    expect((await readFile(resolve(root, 'requests'), 'utf8')).slice(requests.length)).toBe(
        `https://github.com/example/fork/releases/download/${tagPrefix}${version}/${runtimeName}\n`
    );
    expect(await readLock()).toBe(lock);
});

it.each(sources)(
    'rejects a release whose $name source differs from the runtime manifest without changing the lock',
    async (source) => {
        await writeSourcesArchive({ ...publishedSources(), [tarballName(source)]: 'different source' });
        await expect(run('select-runtime.mjs', ['--repo', 'example/fork'])).rejects.toThrow(
            `Published ${source.name} source differs`
        );
        expect(await readLock()).toBe('{}');
    }
);

it.each([
    ['missing', (tarballs) => Object.fromEntries(Object.entries(tarballs).slice(1))],
    ['unexpected', (tarballs) => ({ ...tarballs, 'extra.tar.gz': 'extra' })],
])('rejects a sources archive with %s tarballs', async (_kind, change) => {
    await writeSourcesArchive(change(publishedSources()));
    await expect(run('select-runtime.mjs', ['--repo', 'example/fork'])).rejects.toThrow(
        'does not contain exactly the upstream source tarballs'
    );
    expect(await readLock()).toBe('{}');
});

it('rejects a release that does not publish the sources archive', async () => {
    await rm(resolve(release, sourcesName));
    await expect(run('select-runtime.mjs', ['--repo', 'example/fork'])).rejects.toThrow('HTTP 404');
    expect(await readLock()).toBe('{}');
});

it('rejects a runtime archive whose files differ from its manifest', async () => {
    await writeFile(resolve(runtime, 'ffmpeg-core.wasm'), 'different bytes');
    await writeRuntimeArchive();
    await expect(run('select-runtime.mjs', ['--repo', 'example/fork'])).rejects.toThrow('hash or size mismatch');
    expect(await readLock()).toBe('{}');
});

it('allows simultaneous frozen-runtime preparation and repairs a damaged extracted file', async () => {
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    await Promise.all(Array.from({ length: 3 }, () => run('fetch.mjs')));
    const wasm = resolve(root, 'dist', version, 'ffmpeg-core.wasm');
    expect(await readFile(wasm)).toEqual(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
    await writeFile(wasm, 'corrupt');
    await Promise.all(Array.from({ length: 3 }, () => run('fetch.mjs')));
    expect(await readFile(wasm)).toEqual(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
    expect(await readdir(resolve(root, 'dist'))).toEqual([version]);
    expect(await readdir(resolve(root, '.cache'))).toEqual([]);
});

it('verifies a minimal configuration without requiring redundant disable flags', async () => {
    manifest.ffmpeg.configuration = '--disable-all';
    await writeFile(resolve(runtime, 'manifest.json'), JSON.stringify(manifest));
    await writeRuntimeArchive();
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    await run('fetch.mjs');
    expect((await run('verify-artifacts.mjs')).stdout).toContain(`Verified FFmpeg ${version}`);
});

it.each([
    '--enable-network',
    '--enable-pthreads',
    '--enable-w32threads',
    '--enable-os2threads',
    '--enable-gpl',
    '--enable-nonfree',
    '--enable-version3',
    '--enable-network=yes',
])('rejects a prepared runtime configured with %s', async (argument) => {
    manifest.ffmpeg.configuration += ` ${argument}`;
    await writeFile(resolve(runtime, 'manifest.json'), JSON.stringify(manifest));
    await writeRuntimeArchive();
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    await expect(run('fetch.mjs')).rejects.toThrow(`FFmpeg configuration unexpectedly contains ${argument}`);
});
