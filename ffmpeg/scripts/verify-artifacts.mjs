import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { packageRoot, readJson, runtimeFiles, sha256, upstreamSources, verifyFile } from './lib.mjs';
import { verifyRuntimeArchive } from './runtime-archive-validator.cjs';
import { extractSourcesArchive } from './sources-archive.mjs';
import { releaseNames, runtimeVersion } from './release-names.mjs';

const execFileAsync = promisify(execFile);

const candidate = process.argv.includes('--candidate');
const config = candidate ? await readJson(resolve(packageRoot, 'build-config.json')) : undefined;
const lock = candidate ? undefined : await readJson(resolve(packageRoot, 'artifact-lock.json'));
const version = candidate ? runtimeVersion : lock.runtimeVersion;
if (typeof version !== 'string' || version.length === 0) throw new Error('FFmpeg runtime version is missing');
const names = candidate ? releaseNames(version) : undefined;

const destination = resolve(packageRoot, 'dist', version);
const manifestPath = resolve(destination, 'manifest.json');
let manifest;
try {
    manifest = await readJson(manifestPath);
} catch {
    throw new Error(
        'FFmpeg ' +
            version +
            ' is not prepared. Run pnpm run ' +
            (candidate ? 'build:candidate' : 'fetch') +
            ' from the ffmpeg/ package directory.'
    );
}

const equalSet = (actual, expected) =>
    Array.isArray(actual) && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());

if (manifest.schemaVersion !== 1 || manifest.runtimeVersion !== version || !manifest.ffmpeg) {
    throw new Error('FFmpeg manifest does not match the selected runtime version');
}

if (candidate) {
    const { version: esbuildVersion } = await import('esbuild');
    if (
        manifest.ffmpeg.version !== config.ffmpeg.version ||
        manifest.ffmpeg.revision !== config.ffmpeg.revision ||
        manifest.ffmpeg.sourceSha256 !== config.ffmpeg.source.sha256
    ) {
        throw new Error('FFmpeg manifest does not match project.json and build-config.json');
    }
    if (
        manifest.toolchain?.emscriptenVersion !== config.toolchain.emscriptenVersion ||
        manifest.toolchain.container !== config.toolchain.container ||
        manifest.toolchain.platform !== config.toolchain.platform
    ) {
        throw new Error('Manifest toolchain does not match build-config.json');
    }
    if (manifest.toolchain.bundler?.name !== 'esbuild' || manifest.toolchain.bundler.version !== esbuildVersion) {
        throw new Error('Manifest bundler does not match the installed esbuild version');
    }
    if (!equalSet(manifest.linkedLibraries, config.nativeLibraries)) {
        throw new Error('Linked libraries do not match build-config.json');
    }
    if (!equalSet(manifest.operations, config.implementedOperations)) {
        throw new Error('Implemented operations do not match build-config.json');
    }
    if (JSON.stringify(manifest.limits) !== JSON.stringify(config.limits)) {
        throw new Error('Runtime limits do not match build-config.json');
    }
} else if (
    lock.schemaVersion !== 1 ||
    lock.runtimeVersion !== version ||
    lock.ffmpegVersion !== manifest.ffmpeg.version
) {
    throw new Error('Selected FFmpeg runtime does not match artifact-lock.json');
}

if (
    !Array.isArray(manifest.license?.notices) ||
    manifest.license.notices.some(
        (filename) =>
            typeof filename !== 'string' ||
            !filename.startsWith('notices/') ||
            filename.startsWith('/') ||
            filename.split(/[\\/]/).includes('..')
    )
) {
    throw new Error('FFmpeg manifest contains invalid license notice paths');
}

const forbiddenFeatures = new Set(['network', 'pthreads', 'w32threads', 'os2threads', 'gpl', 'nonfree', 'version3']);
for (const argument of manifest.ffmpeg.configuration.split(/\s+/)) {
    const feature = argument.match(/^--enable-([^=]+)(?:=.*)?$/)?.[1];
    if (forbiddenFeatures.has(feature)) {
        throw new Error('FFmpeg configuration unexpectedly contains ' + argument);
    }
}
if (!/^LGPL version 2\.1 or later/.test(manifest.ffmpeg.license)) {
    throw new Error('Unexpected combined FFmpeg license: ' + manifest.ffmpeg.license);
}
if (manifest.ffmpeg.configuration.split(' ').some((argument) => argument.startsWith('--extra-version='))) {
    throw new Error('FFmpeg configuration must not override the upstream version identity');
}
if (!Number.isSafeInteger(manifest.limits?.maximumWasmBytes) || manifest.limits.maximumWasmBytes <= 0) {
    throw new Error('Manifest has an invalid WASM size limit');
}

if (!Array.isArray(manifest.runtime)) throw new Error('Manifest runtime file inventory is missing');
const runtimeFilenames = new Set(manifest.runtime.map(({ filename }) => filename));
if (manifest.license.notices.some((filename) => !runtimeFilenames.has(filename))) {
    throw new Error('FFmpeg manifest license notices are missing from the runtime file inventory');
}
const verifyRuntimeDirectory = async (root) => {
    const actualFiles = [...(await runtimeFiles(root)), 'manifest.json'].sort();
    const declaredFiles = [...manifest.runtime.map(({ filename }) => filename), 'manifest.json'].sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(declaredFiles)) {
        throw new Error('Runtime file inventory is incomplete');
    }
    for (const entry of manifest.runtime) {
        if (
            typeof entry.filename !== 'string' ||
            entry.filename.startsWith('/') ||
            entry.filename.split(/[\\/]/).includes('..')
        ) {
            throw new Error('Runtime manifest contains an unsafe file path');
        }
        const path = resolve(root, entry.filename);
        const fileStat = await stat(path);
        if (fileStat.size !== entry.bytes || (await sha256(path)) !== entry.sha256) {
            throw new Error('Runtime hash or size mismatch for ' + entry.filename);
        }
    }
};
await verifyRuntimeDirectory(destination);

const release = resolve(packageRoot, 'release');
const runtimeArchive = resolve(release, candidate ? names.runtimeArchive : lock.runtimeArchive.filename);
if (candidate) {
    if (JSON.stringify(manifest.sources) !== JSON.stringify(upstreamSources(config))) {
        throw new Error('Upstream sources do not match build-config.json');
    }
    // The release publishes the unmodified upstream tarballs in one sources archive.
    const extractedSources = await mkdtemp(resolve(tmpdir(), 'asbplayer-ffmpeg-sources-'));
    try {
        await extractSourcesArchive(
            resolve(release, names.sourcesArchive),
            version,
            manifest.sources,
            extractedSources
        );
    } finally {
        await rm(extractedSources, { recursive: true, force: true });
    }
} else {
    await verifyFile(runtimeArchive, lock.runtimeArchive.sha256);
    if ((await stat(runtimeArchive)).size !== lock.runtimeArchive.bytes) {
        throw new Error('Runtime archive size differs from artifact-lock.json');
    }
}
// The app downloads only this archive, so it must contain exactly the verified runtime directory.
await verifyRuntimeArchive(runtimeArchive, version);
const extracted = await mkdtemp(resolve(tmpdir(), 'asbplayer-ffmpeg-verify-'));
try {
    await execFileAsync('tar', ['-xzf', runtimeArchive, '-C', extracted]);
    const archived = resolve(extracted, version);
    if ((await sha256(resolve(archived, 'manifest.json'))) !== (await sha256(manifestPath))) {
        throw new Error('Runtime archive manifest differs from the prepared runtime');
    }
    await verifyRuntimeDirectory(archived);
} finally {
    await rm(extracted, { recursive: true, force: true });
}

const wasmPath = resolve(destination, 'ffmpeg-core.wasm');
const wasm = new WebAssembly.Module(await readFile(wasmPath));
const exports = new Set(WebAssembly.Module.exports(wasm).map(({ name }) => name));
const glue = await readFile(resolve(destination, 'ffmpeg-core.js'), 'utf8');
for (const name of ['asb_runtime_info_json']) {
    if (!exports.has(name) && !glue.includes('_' + name)) throw new Error('WASM export ' + name + ' is missing');
}
const imports = WebAssembly.Module.imports(wasm).map(({ module: namespace, name }) => namespace + '.' + name);
if (imports.some((name) => /pthread|wasi.*thread/i.test(name))) throw new Error('WASM imports threading support');
for (const filename of ['ffmpeg-worker.js', 'ffmpeg-core.js']) {
    const source = await readFile(resolve(destination, filename), 'utf8');
    if (/https?:\/\/|unpkg\.com|new Function\s*\(|\beval\s*\(|@ffmpeg\/ffmpeg|ffprobe/.test(source)) {
        throw new Error(filename + ' contains a remote, dynamic, wrapper, or CLI path');
    }
}
const wasmBytes = (await stat(wasmPath)).size;
if (wasmBytes > manifest.limits.maximumWasmBytes) {
    throw new Error('FFmpeg WASM exceeds the configured size ceiling');
}

process.stdout.write('Verified FFmpeg ' + version + (candidate ? ' candidate' : ' frozen runtime') + '\n');
