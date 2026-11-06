import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const runtimeRoot = resolve(process.argv[2] ?? '/output');
const expectedRuntimeVersion = process.env.ASB_RUNTIME_VERSION;
const expectedFfmpegVersion = process.env.ASB_FFMPEG_VERSION;
assert.ok(expectedRuntimeVersion, 'ASB_RUNTIME_VERSION must be passed to the Docker test target');
assert.ok(expectedFfmpegVersion, 'ASB_FFMPEG_VERSION must be passed to the Docker test target');

const configMak = await readFile(resolve(runtimeRoot, 'config.mak'), 'utf8');
const configHeader = await readFile(resolve(runtimeRoot, 'config.h'), 'utf8');
const expectedConfiguration = configMak.match(/^FFMPEG_CONFIGURATION=(.*)$/m)?.[1];
const expectedLicense = configHeader.match(/^#define FFMPEG_LICENSE "([^"]+)"$/m)?.[1];
assert.ok(expectedConfiguration, 'FFMPEG_CONFIGURATION must be present in config.mak');
assert.ok(expectedLicense, 'FFMPEG_LICENSE must be present in config.h');

const wasmBytes = await readFile(resolve(runtimeRoot, 'ffmpeg-core.wasm'));
const { default: createRuntime } = await import(pathToFileURL(resolve(runtimeRoot, 'ffmpeg-core.js')).href);
const module = await createRuntime({
    instantiateWasm(imports, receiveInstance) {
        const instance = new WebAssembly.Instance(new WebAssembly.Module(wasmBytes), imports);
        receiveInstance(instance);
        return {};
    },
});
const info = JSON.parse(module.UTF8ToString(module._asb_runtime_info_json()));

assert.deepEqual(Object.keys(info).sort(), [
    'ffmpegConfiguration',
    'ffmpegLicense',
    'ffmpegVersion',
    'libraries',
    'linkedLibraries',
    'operations',
    'runtimeVersion',
]);
assert.equal(info.runtimeVersion, expectedRuntimeVersion);
assert.equal(info.ffmpegVersion, expectedFfmpegVersion);
assert.equal(info.ffmpegConfiguration, expectedConfiguration);
assert.equal(info.ffmpegLicense, expectedLicense);
assert.deepEqual(info.linkedLibraries, ['libavutil']);
assert.deepEqual(info.operations, ['inspect']);
assert.equal(info.libraries.length, 1);
assert.equal(info.libraries[0].name, 'libavutil');
assert.ok(Number.isSafeInteger(info.libraries[0].version) && info.libraries[0].version > 0);
assert.equal(info.libraries[0].configuration, expectedConfiguration);
assert.equal(info.libraries[0].license, expectedLicense);

process.stdout.write(
    `WASM runtime smoke test passed: asbplayer ${info.runtimeVersion}, FFmpeg ${info.ffmpegVersion}\n`
);
