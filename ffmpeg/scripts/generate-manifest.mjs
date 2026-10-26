import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { version as esbuildVersion } from 'esbuild';
import { inspectRuntime } from './inspect-runtime.mjs';
import { fileInfo, packageRoot, readJson, runtimeFiles, upstreamSources } from './lib.mjs';
import { runtimeVersion as version } from './release-names.mjs';

const config = await readJson(resolve(packageRoot, 'build-config.json'));
const destination = resolve(packageRoot, 'dist', version);
const dockerOutput = resolve(packageRoot, '.cache', 'docker-output');
const configMakPath = resolve(dockerOutput, 'config.mak');
const configHeaderPath = resolve(dockerOutput, 'config.h');
const configMak = await readFile(configMakPath, 'utf8');
const configHeader = await readFile(configHeaderPath, 'utf8');
const compiler = (await readFile(resolve(dockerOutput, 'compiler-version.txt'), 'utf8')).split('\n')[0];
const configuration = configMak
    .split('\n')
    .find((line) => line.startsWith('FFMPEG_CONFIGURATION='))
    ?.slice(21);
const license = configHeader.match(/^#define FFMPEG_LICENSE "([^"]+)"$/m)?.[1];
if (!configuration || !license) throw new Error('FFmpeg configuration or license was not recorded by configure');

const inventory = await readJson(resolve(packageRoot, 'runtime-assets.json'));
const measured = await inspectRuntime(destination);
if (
    measured.info.runtimeVersion !== version ||
    measured.info.ffmpegVersion !== config.ffmpeg.version ||
    measured.info.ffmpegConfiguration !== configuration ||
    measured.info.ffmpegLicense !== license
) {
    throw new Error('Compiled runtime identity does not match the build inputs.');
}
if (measured.memory.initialBytes !== config.limits.initialMemoryBytes || measured.memory.shared) {
    throw new Error('Compiled runtime memory does not match the single-threaded build inputs.');
}
const runtime = await Promise.all(
    (await runtimeFiles(destination)).map(async (filename) => ({
        ...(await fileInfo(resolve(destination, filename))),
        filename,
    }))
);
const manifest = {
    schemaVersion: 1,
    runtimeVersion: version,
    ffmpeg: {
        version: config.ffmpeg.version,
        revision: config.ffmpeg.revision,
        sourceUrl: config.ffmpeg.source.url,
        sourceSha256: config.ffmpeg.source.sha256,
        configuration,
        license,
    },
    sources: upstreamSources(config),
    toolchain: { ...config.toolchain, bundler: { name: 'esbuild', version: esbuildVersion }, compiler },
    license: {
        notices: inventory.notices.map((filename) => `notices/${filename}`),
    },
    linkedLibraries: measured.info.linkedLibraries,
    libraries: measured.info.libraries,
    operations: measured.info.operations,
    // Declared build inputs; wasmMemory records observed memory from the compiled module.
    limits: config.limits,
    wasmMemory: measured.memory,
    bridgeCompileArguments: ['-std=c++23', '-O3', '-fno-exceptions', '-fno-rtti'],
    runtime,
};
await writeFile(resolve(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
