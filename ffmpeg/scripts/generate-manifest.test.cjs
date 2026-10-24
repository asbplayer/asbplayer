/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { createHash } = require('node:crypto');
const { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { promisify } = require('node:util');
const { version: esbuildVersion } = require('esbuild');

const exec = promisify(execFile);
const version = '0.1.0';
const stem = `example-ffmpeg-${version}`;
const configuration = '--disable-all --disable-autodetect --disable-pthreads';
const license = 'LGPL version 2.1 or later';
const digest = (body) => createHash('sha256').update(body).digest('hex');
let repositoryRoot;
let root;
let runtime;
let archive;

const run = (script, args = []) => exec(process.execPath, [resolve(root, 'scripts', script), ...args]);
const readManifest = async () => JSON.parse(await readFile(resolve(runtime, 'manifest.json'), 'utf8'));
const writeManifest = (manifest) => writeFile(resolve(runtime, 'manifest.json'), JSON.stringify(manifest));
const packageRuntime = () => exec('tar', ['--format=ustar', '-czf', archive, '-C', resolve(root, 'dist'), version]);

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
        'release-names.mjs',
        'verify-artifacts.mjs',
        'runtime-archive-validator.cjs',
        'sources-archive.mjs',
    ]) {
        await copyFile(resolve(__dirname, script), resolve(root, 'scripts', script));
    }
    await symlink(resolve(__dirname, '../node_modules/esbuild'), resolve(root, 'node_modules/esbuild'), 'dir');
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ type: 'module' }));
    await writeFile(
        resolve(repositoryRoot, 'project.json'),
        JSON.stringify({ artifacts: { ffmpeg: { version, prefix: 'example-ffmpeg', tagPrefix: 'runtime-v' } } })
    );

    const config = JSON.parse(await readFile(resolve(__dirname, '../build-config.json'), 'utf8'));
    config.limits.initialMemoryBytes = 65536;
    const upstream = 'Example upstream source tarball';
    config.ffmpeg.source.sha256 = digest(upstream);
    await writeFile(resolve(root, 'build-config.json'), JSON.stringify(config));
    const sourcesRoot = resolve(root, 'sources', `${stem}-sources`);
    await mkdir(sourcesRoot, { recursive: true });
    await writeFile(resolve(sourcesRoot, 'ffmpeg-9.0.2.tar.gz'), upstream);
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
    expect(manifest.toolchain.bundler).toEqual({ name: 'esbuild', version: esbuildVersion });
    expect((await run('verify-artifacts.mjs', ['--candidate'])).stdout).toContain('candidate');

    manifest.toolchain.bundler.version = '0.0.0';
    await writeManifest(manifest);
    await expect(run('verify-artifacts.mjs', ['--candidate'])).rejects.toThrow(
        'Manifest bundler does not match the installed esbuild version'
    );
});

it('verifies a frozen runtime built with an older bundler without requiring an installed bundler', async () => {
    const manifest = await readManifest();
    manifest.toolchain.bundler.version = '0.0.0';
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
    await rm(resolve(root, 'node_modules'), { recursive: true, force: true });
    expect((await run('verify-artifacts.mjs')).stdout).toContain('frozen runtime');
});
