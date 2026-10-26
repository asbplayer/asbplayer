/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { promisify } = require('node:util');

const exec = promisify(execFile);
const version = '0.1.0';
const releaseConfig = {
    version,
    releaseTitle: 'Example runtime {{version}}',
    releaseTag: 'example-runtime-v{{version}}',
    artifact: 'example-ffmpeg-{{version}}-runtime',
    sources: 'example-ffmpeg-{{version}}-sources',
};
const tag = `example-runtime-v${version}`;
const runtimeName = `example-ffmpeg-${version}-runtime.tar.gz`;
const sourcesName = `example-ffmpeg-${version}-sources.tar.gz`;
const sourcesRoot = `example-ffmpeg-${version}-sources`;
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
const configureGithub = (options) => writeFile(resolve(root, 'github.json'), JSON.stringify(options));
const prepareRuntime = async () => {
    await mkdir(resolve(root, 'release'), { recursive: true });
    await copyFile(resolve(release, runtimeName), resolve(root, 'release', runtimeName));
    await mkdir(resolve(root, 'dist'), { recursive: true });
    await exec('tar', ['-xzf', resolve(release, runtimeName), '-C', resolve(root, 'dist')]);
};

beforeEach(async () => {
    repositoryRoot = await mkdtemp(resolve(tmpdir(), 'asbplayer-release-test-'));
    root = resolve(repositoryRoot, 'ffmpeg');
    release = resolve(root, 'published');
    await mkdir(resolve(root, 'scripts'), { recursive: true });
    await writeFile(resolve(repositoryRoot, 'project.json'), JSON.stringify({ releases: { ffmpeg: releaseConfig } }));
    await mkdir(release);
    for (const script of [
        'lib.mjs',
        'runtime-manifest.mjs',
        'runtime-version.mjs',
        'release-names.mjs',
        'release-info.mjs',
        'select-runtime.mjs',
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
    await configureGithub({});
    // HTTP is the only fake boundary; selection/extraction/hash checks use actual files and processes.
    await writeFile(
        resolve(root, 'http.mjs'),
        `import { readFile, appendFile } from 'node:fs/promises';
        import { createHash } from 'node:crypto';
        globalThis.fetch = async (url, init = {}) => {
            await appendFile(${JSON.stringify(resolve(root, 'requests'))}, url + '\\n');
            await new Promise(resolve => setTimeout(resolve, 25));
            const options = JSON.parse(await readFile(${JSON.stringify(resolve(root, 'github.json'))}, 'utf8'));
            const parsed = new URL(url);
            const headers = new Headers(init.headers);
            const authorized = headers.get('Authorization') === 'Bearer test-token';
            const filenames = ${JSON.stringify([runtimeName, sourcesName])};
            const assets = [];
            for (const [index, name] of filenames.entries()) {
                try {
                    const body = await readFile(${JSON.stringify(release)} + '/' + name);
                    assets.push({
                        id: index + 1, name, size: body.byteLength,
                        digest: 'sha256:' + createHash('sha256').update(body).digest('hex'),
                        ...options.assets?.[name],
                    });
                } catch { /* A missing file is also absent from the release's assets. */ }
            }
            const release = { tag_name: ${JSON.stringify(tag)}, draft: !!options.draft, assets };
            if (parsed.hostname === 'api.github.com') {
                if (parsed.pathname.includes('/assets/')) {
                    if (headers.get('Accept') !== 'application/octet-stream' || (options.draft && !authorized)) {
                        return new Response('Unauthorized', { status: 401 });
                    }
                    return new Response(await readFile(${JSON.stringify(release)} + '/' + filenames[Number(parsed.pathname.split('/').pop()) - 1]));
                }
                if (options.status) return new Response('API failure', { status: options.status });
                if (parsed.pathname.includes('/tags/')) {
                    return options.draft || options.missingRelease
                        ? new Response('Not Found', { status: 404 }) : Response.json(release);
                }
                if (options.missingRelease || (options.draft && !authorized)) return Response.json([]);
                const page = Number(parsed.searchParams.get('page'));
                return Response.json(page <= (options.pagesBeforeMatch ?? 0)
                    ? Array.from({ length: 100 }, (_, index) => ({ tag_name: 'other-' + page + '-' + index }))
                    : [release]);
            }
            if (options.draft) return new Response('Not Found', { status: 404 });
            try {
                return new Response(await readFile(${JSON.stringify(release)} + '/' + parsed.pathname.split('/').pop()));
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
        `version=${version}\ntag=${tag}\ntitle=Example runtime ${version}\nruntimeArchive=${runtimeName}\nsourcesArchive=${sourcesName}\nsourcesRoot=${sourcesRoot}\n`
    );
    expect((await run('release-info.mjs', ['runtimeArchive'])).stdout).toBe(`${runtimeName}\n`);
});

it('expands independent release templates using the configured runtime version', async () => {
    await writeFile(
        resolve(repositoryRoot, 'project.json'),
        JSON.stringify({
            releases: {
                ffmpeg: {
                    version: '0.2.0-rc.1',
                    releaseTitle: 'Runtime {{version}} ({{version}})',
                    releaseTag: 'custom-{{version}}',
                    artifact: 'binary-{{version}}',
                    sources: 'upstream-{{version}}',
                },
            },
        })
    );
    expect((await run('release-info.mjs')).stdout).toBe(
        'version=0.2.0-rc.1\ntag=custom-0.2.0-rc.1\ntitle=Runtime 0.2.0-rc.1 (0.2.0-rc.1)\nruntimeArchive=binary-0.2.0-rc.1.tar.gz\nsourcesArchive=upstream-0.2.0-rc.1.tar.gz\nsourcesRoot=upstream-0.2.0-rc.1\n'
    );
});

it('selects a fork release, records the runtime archive, and accepts identical reselection', async () => {
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    const lock = JSON.parse(await readLock());
    const archive = await readFile(resolve(release, runtimeName));
    expect(lock).toEqual({
        schemaVersion: 1,
        runtimeVersion: version,
        ffmpegVersion: '9.0.2',
        releaseUrl: `https://github.com/example/fork/releases/tag/${tag}`,
        releaseBaseDownloadUrl: `https://github.com/example/fork/releases/download/${tag}`,
        runtimeArchive: { filename: runtimeName, sha256: digest(archive), bytes: archive.byteLength },
    });
    expect((await readFile(resolve(root, 'requests'), 'utf8')).split('\n').filter(Boolean)).toEqual([
        `https://api.github.com/repos/example/fork/releases/tags/${tag}`,
        'https://api.github.com/repos/example/fork/releases/assets/1',
        'https://api.github.com/repos/example/fork/releases/assets/2',
    ]);
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    await expect(run('select-runtime.mjs', ['--repo', 'different/fork'])).rejects.toThrow('immutable');
});

it('rejects noncanonical runtime versions before contacting GitHub or changing the lock', async () => {
    for (const version of [
        undefined,
        null,
        0,
        ['0.1.0'],
        '',
        '1.0.0',
        '0.3',
        '0.3.4.5',
        '00.3.4',
        '0.03.4',
        '0.3.04',
        '0.-1.0',
        '0.3.-1',
        'v0.3.4',
        '0.3.4-rc.1',
        '0.3.4+build.1',
        ' 0.3.4',
        '0.3.4 ',
        '0.3.4\n',
    ]) {
        await writeFile(
            resolve(repositoryRoot, 'project.json'),
            JSON.stringify({ releases: { ffmpeg: { ...releaseConfig, version } } })
        );
        await expect(run('select-runtime.mjs', ['--repo', 'example/fork'])).rejects.toThrow(
            `FFmpeg runtime version must be 0.X.Y with no leading zeros or suffixes; received ${JSON.stringify(version)}`
        );
        expect(await readLock()).toBe('{}');
    }
    await expect(readFile(resolve(root, 'requests'))).rejects.toMatchObject({ code: 'ENOENT' });
});

it.each(['GH_TOKEN', 'GITHUB_TOKEN'])(
    'selects an authenticated draft using %s, including releases beyond the first page',
    async (tokenVariable) => {
        await configureGithub({ draft: true, pagesBeforeMatch: 1 });
        const env = { ...process.env, GH_TOKEN: '', GITHUB_TOKEN: '', [tokenVariable]: 'test-token' };
        const { stdout } = await run('select-runtime.mjs', ['--repo', 'example/fork'], env);
        const lock = await readLock();
        expect(JSON.parse(lock).runtimeArchive.sha256).toBe(digest(await readFile(resolve(release, runtimeName))));
        expect(stdout).toContain('Publish the selected draft');

        // Publishing does not change the canonical URLs or the selected bytes.
        await configureGithub({});
        await run('select-runtime.mjs', ['--repo', 'example/fork'], env);
        expect(await readLock()).toBe(lock);
    }
);

it('uses the existing GitHub CLI login when no token environment variable is set', async () => {
    await configureGithub({ draft: true });
    const bin = resolve(root, 'bin');
    await mkdir(bin);
    await writeFile(resolve(bin, 'gh'), '#!/bin/sh\nprintf test-token');
    await chmod(resolve(bin, 'gh'), 0o755);
    await run('select-runtime.mjs', ['--repo', 'example/fork'], {
        ...process.env,
        GH_TOKEN: '',
        GITHUB_TOKEN: '',
        PATH: `${bin}:${process.env.PATH}`,
    });
    expect(JSON.parse(await readLock()).runtimeVersion).toBe(version);
});

it('selects a public release without GitHub credentials or the GitHub CLI', async () => {
    const bin = resolve(root, 'bin');
    await mkdir(bin);
    await writeFile(resolve(bin, 'gh'), '#!/bin/sh\nexit 127');
    await chmod(resolve(bin, 'gh'), 0o755);
    const env = { ...process.env, GH_TOKEN: '', GITHUB_TOKEN: '', PATH: `${bin}:${process.env.PATH}` };
    await run('select-runtime.mjs', ['--repo', 'example/fork'], env);
    expect(JSON.parse(await readLock()).runtimeVersion).toBe(version);
});

it('reports a missing or inaccessible release without changing the lock', async () => {
    await configureGithub({ missingRelease: true });
    await expect(run('select-runtime.mjs', ['--repo', 'example/fork'])).rejects.toThrow('For drafts, set GH_TOKEN');
    expect(await readLock()).toBe('{}');
});

it.each([401, 403, 500])('reports GitHub API HTTP %s without changing the lock', async (status) => {
    await configureGithub({ status });
    await expect(run('select-runtime.mjs', ['--repo', 'example/fork'])).rejects.toThrow(`HTTP ${status}`);
    expect(await readLock()).toBe('{}');
});

it.each([runtimeName, sourcesName])('rejects %s when its GitHub digest or size differs', async (filename) => {
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    const lock = await readLock();
    for (const override of [{ digest: `sha256:${'0'.repeat(64)}` }, { size: 1 }]) {
        await configureGithub({ assets: { [filename]: override } });
        await expect(run('select-runtime.mjs', ['--repo', 'example/fork'])).rejects.toThrow(
            `GitHub SHA-256 or size mismatch for ${filename}`
        );
        expect(await readLock()).toBe(lock);
    }
});

it.each([null, '', 'sha256:invalid', `sha512:${'a'.repeat(64)}`])(
    'rejects an unavailable or invalid GitHub digest (%s) without changing the lock',
    async (digest) => {
        await configureGithub({ assets: { [runtimeName]: { digest } } });
        await expect(run('select-runtime.mjs', ['--repo', 'example/fork'])).rejects.toThrow('no valid SHA-256');
        expect(await readLock()).toBe('{}');
    }
);

it('uses the workflow repository when no CLI repository is supplied', async () => {
    await run('select-runtime.mjs', [], { ...process.env, GH_REPO: '', GITHUB_REPOSITORY: 'workflow/repo' });
    expect(JSON.parse(await readLock()).releaseUrl).toContain('workflow/repo');
});

it('keeps the selected runtime pinned when the project development version advances', async () => {
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    const lock = await readLock();
    await writeFile(
        resolve(repositoryRoot, 'project.json'),
        JSON.stringify({ releases: { ffmpeg: { ...releaseConfig, version: '0.2.0' } } })
    );
    await prepareRuntime();
    await run('verify-artifacts.mjs');
    expect(await readLock()).toBe(lock);
    await copyFile(resolve(__dirname, '../build-config.json'), resolve(root, 'build-config.json'));
    await expect(run('verify-artifacts.mjs', ['--candidate'])).rejects.toThrow('FFmpeg 0.2.0 is not prepared');
});

it('keeps the frozen archive pinned when the project release naming changes', async () => {
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    await prepareRuntime();
    const lock = await readLock();
    await writeFile(
        resolve(repositoryRoot, 'project.json'),
        JSON.stringify({
            releases: {
                ffmpeg: {
                    ...releaseConfig,
                    releaseTitle: 'Renamed runtime {{version}}',
                    releaseTag: 'renamed-runtime-v{{version}}',
                    artifact: 'renamed-ffmpeg-{{version}}-runtime',
                    sources: 'renamed-ffmpeg-{{version}}-sources',
                },
            },
        })
    );
    expect((await run('release-info.mjs', ['runtimeArchive'])).stdout).toBe(
        `renamed-ffmpeg-${version}-runtime.tar.gz\n`
    );
    expect((await run('verify-artifacts.mjs')).stdout).toContain(`Verified FFmpeg ${version} frozen runtime`);
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
    await expect(run('select-runtime.mjs', ['--repo', 'example/fork'])).rejects.toThrow(`missing ${sourcesName}`);
    expect(await readLock()).toBe('{}');
});

it('rejects a runtime archive whose files differ from its manifest', async () => {
    await writeFile(resolve(runtime, 'ffmpeg-core.wasm'), 'different bytes');
    await writeRuntimeArchive();
    await expect(run('select-runtime.mjs', ['--repo', 'example/fork'])).rejects.toThrow('hash or size mismatch');
    expect(await readLock()).toBe('{}');
});

it('verifies a minimal configuration without requiring redundant disable flags', async () => {
    manifest.ffmpeg.configuration = '--disable-all';
    await writeFile(resolve(runtime, 'manifest.json'), JSON.stringify(manifest));
    await writeRuntimeArchive();
    await run('select-runtime.mjs', ['--repo', 'example/fork']);
    await prepareRuntime();
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
    await prepareRuntime();
    await expect(run('verify-artifacts.mjs')).rejects.toThrow(`FFmpeg configuration unexpectedly contains ${argument}`);
});
