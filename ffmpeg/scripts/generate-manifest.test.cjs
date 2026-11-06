/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const { copyFile, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { promisify } = require('node:util');

const exec = promisify(execFile);
const version = '0.1.0';
const stem = `example-ffmpeg-${version}`;
const configuration = '--disable-all --disable-autodetect --disable-pthreads --enable-version3';
const license = 'LGPL version 3 or later';
const digest = (body) => createHash('sha256').update(body).digest('hex');
let repositoryRoot;
let root;
let runtime;
let archive;

const run = (script, args = [], env = {}) =>
    exec(process.execPath, [resolve(root, 'scripts', script), ...args], {
        env: { ...process.env, ASB_FFMPEG_RUNTIME_VERSION: undefined, ...env },
    });
const readManifest = async () => JSON.parse(await readFile(resolve(runtime, 'manifest.json'), 'utf8'));
const writeManifest = (manifest) => writeFile(resolve(runtime, 'manifest.json'), JSON.stringify(manifest));
const packageRuntime = async () => {
    const staging = resolve(root, 'runtime-staging');
    const runtimeRoot = `${stem}-runtime`;
    await rm(staging, { recursive: true, force: true });
    await cp(runtime, resolve(staging, runtimeRoot), { recursive: true });
    await exec('tar', ['--format=ustar', '-czf', archive, '-C', staging, runtimeRoot]);
};

beforeEach(async () => {
    repositoryRoot = await mkdtemp(resolve(tmpdir(), 'asbplayer-manifest-test-'));
    root = resolve(repositoryRoot, 'ffmpeg');
    runtime = resolve(root, 'dist', version);
    archive = resolve(root, 'release', `${stem}-runtime.tar.gz`);
    for (const directory of ['scripts', 'node_modules', '.cache/docker-output', `dist/${version}/notices`, 'release']) {
        await mkdir(resolve(root, directory), { recursive: true });
    }
    for (const script of [
        'generate-manifest.mjs',
        'inspect-runtime.mjs',
        'lib.mjs',
        'runtime-manifest.mjs',
        'runtime-version.mjs',
        'release-names.mjs',
        'verify-artifacts.mjs',
        'runtime-archive-validator.cjs',
        'sources-archive.mjs',
    ]) {
        await copyFile(resolve(__dirname, script), resolve(root, 'scripts', script));
    }
    await symlink(resolve(__dirname, '../node_modules/rolldown'), resolve(root, 'node_modules/rolldown'), 'dir');
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ type: 'module' }));
    await writeFile(resolve(root, 'artifact-lock.json'), JSON.stringify({ runtimeVersion: version }));
    await writeFile(
        resolve(repositoryRoot, 'project.json'),
        JSON.stringify({
            releases: {
                ffmpeg: {
                    releaseTitle: 'example-ffmpeg-v{{version}}',
                    releaseTag: 'runtime-v{{version}}',
                    artifact: 'example-ffmpeg-{{version}}-runtime',
                    sources: 'example-ffmpeg-{{version}}-sources',
                },
            },
        })
    );

    const config = JSON.parse(await readFile(resolve(__dirname, '../build-config.json'), 'utf8'));
    config.limits.initialMemoryBytes = 65536;
    const sourcesRoot = resolve(root, 'sources', `${stem}-sources`);
    await mkdir(sourcesRoot, { recursive: true });
    for (const [name, dependency] of Object.entries(config)) {
        if (!dependency?.source) continue;
        const upstream = `Example ${name} source tarball`;
        dependency.source.url = `https://example.com/${name}.tar.gz`;
        dependency.source.sha256 = digest(upstream);
        await writeFile(resolve(sourcesRoot, `${name}.tar.gz`), upstream);
    }
    await writeFile(resolve(root, 'build-config.json'), JSON.stringify(config));
    await exec('tar', [
        '--format=ustar',
        '-czf',
        resolve(root, 'release', `${stem}-sources.tar.gz`),
        '-C',
        resolve(root, 'sources'),
        `${stem}-sources`,
    ]);

    const inventory = JSON.parse(await readFile(resolve(__dirname, '../runtime-assets.json'), 'utf8'));
    await writeFile(resolve(root, 'runtime-assets.json'), JSON.stringify(inventory));
    for (const filename of inventory.notices) {
        await writeFile(resolve(runtime, 'notices', filename), `Example notice: ${filename}`);
    }
    const dockerOutput = resolve(root, '.cache/docker-output');
    await writeFile(resolve(dockerOutput, 'config.mak'), `FFMPEG_CONFIGURATION=${configuration}\n`);
    await writeFile(resolve(dockerOutput, 'config.h'), `#define FFMPEG_LICENSE "${license}"\n`);
    await writeFile(resolve(dockerOutput, 'compiler-version.txt'), 'Example compiler\n');

    const info = {
        runtimeVersion: version,
        ffmpegVersion: config.ffmpeg.version,
        ffmpegConfiguration: configuration,
        ffmpegLicense: license,
        linkedLibraries: config.nativeLibraries,
        operations: config.implementedOperations,
        libraries: [],
    };
    // A real minimal WASM module exporting one 64 KiB memory page. The JS fixture
    // supplies bridge identity so inspection and archive verification run normally.
    await writeFile(
        resolve(runtime, 'ffmpeg-core.wasm'),
        Buffer.from([0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 0, 1, 7, 10, 1, 6, 109, 101, 109, 111, 114, 121, 2, 0])
    );
    await writeFile(
        resolve(runtime, 'ffmpeg-core.js'),
        `
        export default async ({ instantiateWasm }) => {
            instantiateWasm({}, () => {});
            return {
                _asb_runtime_info_json: () => 0,
                _asb_transcode_audio: () => 0,
                _asb_last_error: () => 0,
                UTF8ToString: () => ${JSON.stringify(JSON.stringify(info))},
            };
        };
    `
    );
    await writeFile(resolve(runtime, 'ffmpeg-worker.js'), 'export {};');
    await run('generate-manifest.mjs');
    await packageRuntime();
});

afterEach(async () => {
    await rm(repositoryRoot, { recursive: true, force: true });
});

it('records the installed bundler and rejects candidates built with a different version', async () => {
    const manifest = await readManifest();
    const { stdout } = await exec(
        process.execPath,
        ['--input-type=module', '-e', "import { VERSION } from 'rolldown'; console.log(VERSION);"],
        { cwd: root }
    );
    expect(manifest.toolchain.bundler).toEqual({ name: 'rolldown', version: stdout.trim() });
    expect((await run('verify-artifacts.mjs', ['--candidate'])).stdout).toContain('candidate');

    manifest.toolchain.bundler.version = '0.0.0';
    await writeManifest(manifest);
    await expect(run('verify-artifacts.mjs', ['--candidate'])).rejects.toThrow(
        'Manifest bundler does not match the installed rolldown version'
    );
});

it('accepts equivalent build inputs with reordered object properties', async () => {
    const manifest = await readManifest();
    manifest.limits = Object.fromEntries(Object.entries(manifest.limits).reverse());
    manifest.sources = manifest.sources.map((source) => Object.fromEntries(Object.entries(source).reverse()));
    await writeManifest(manifest);
    await packageRuntime();
    expect((await run('verify-artifacts.mjs', ['--candidate'])).stdout).toContain('candidate');
});

it('packages and verifies a release version override while leaving the selected runtime unchanged', async () => {
    const lockPath = resolve(root, 'artifact-lock.json');
    const lock = JSON.stringify({ runtimeVersion: '0.0.0' });
    await writeFile(lockPath, lock);
    const env = { ASB_FFMPEG_RUNTIME_VERSION: version };
    await run('generate-manifest.mjs', [], env);
    await packageRuntime();
    expect((await readManifest()).runtimeVersion).toBe(version);
    expect((await run('verify-artifacts.mjs', ['--candidate'], env)).stdout).toContain('candidate');
    expect(await readFile(lockPath, 'utf8')).toBe(lock);
});

it('verifies the selected LGPLv3 runtime without requiring an installed bundler', async () => {
    const body = await readFile(archive);
    await writeFile(
        resolve(root, 'artifact-lock.json'),
        JSON.stringify({
            schemaVersion: 1,
            runtimeVersion: version,
            ffmpegVersion: (await readManifest()).ffmpeg.version,
            runtimeArchive: { filename: `${stem}-runtime.tar.gz`, bytes: body.byteLength, sha256: digest(body) },
        })
    );
    await rm(resolve(root, 'node_modules'), { recursive: true, force: true });
    expect((await run('verify-artifacts.mjs')).stdout).toContain('frozen runtime');
});

it.each([
    ['license', 'LGPL version 2.1 or later', 'Unexpected combined FFmpeg license'],
    ['configuration', '--disable-all', 'must enable --enable-version3'],
    ['notices', [], 'LGPL 3 and GPL 3 license texts'],
])('rejects selected releases with an unexpected %s', async (field, value, message) => {
    const manifest = await readManifest();
    if (field === 'notices') manifest.license.notices = value;
    else manifest.ffmpeg[field] = value;
    await writeManifest(manifest);
    await packageRuntime();
    const body = await readFile(archive);
    await writeFile(
        resolve(root, 'artifact-lock.json'),
        JSON.stringify({
            schemaVersion: 1,
            runtimeVersion: version,
            ffmpegVersion: manifest.ffmpeg.version,
            runtimeArchive: { filename: `${stem}-runtime.tar.gz`, bytes: body.byteLength, sha256: digest(body) },
        })
    );
    await expect(run('verify-artifacts.mjs')).rejects.toThrow(message);
});

it.each([
    ['license', 'LGPL version 2.1 or later', 'Unexpected combined FFmpeg license'],
    ['configuration', '--disable-all', 'must enable --enable-version3'],
    ['configuration', `${configuration} --enable-gpl`, 'unexpectedly contains --enable-gpl'],
])('rejects candidates with an unexpected %s', async (field, value, message) => {
    const manifest = await readManifest();
    manifest.ffmpeg[field] = value;
    await writeManifest(manifest);
    await expect(run('verify-artifacts.mjs', ['--candidate'])).rejects.toThrow(message);
});

it('rejects a version 3 candidate that omits the accompanying GPL 3 license text', async () => {
    const manifest = await readManifest();
    manifest.license.notices = manifest.license.notices.filter((filename) => filename !== 'notices/FFmpeg-GPL-3.0.txt');
    await writeManifest(manifest);
    await expect(run('verify-artifacts.mjs', ['--candidate'])).rejects.toThrow('LGPL 3 and GPL 3 license texts');
});
