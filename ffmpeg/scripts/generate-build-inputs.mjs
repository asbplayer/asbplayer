import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { packageRoot, readJson } from './lib.mjs';
import { runtimeVersion } from './release-names.mjs';

const config = await readJson(resolve(packageRoot, 'build-config.json'));
const buildDirectory = resolve(packageRoot, '.cache', 'build');
const positiveInteger = (name, value) => {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive safe integer`);
    return value;
};

const ffmpegConfigureArguments = [
    '--disable-all',
    '--disable-autodetect',
    '--target-os=none',
    '--arch=wasm32',
    '--enable-cross-compile',
    '--enable-version3',
    '--disable-debug',
    '--disable-pthreads',
    '--enable-small',
    '--disable-network',
    '--disable-iconv',
    '--enable-avcodec',
    '--enable-avformat',
    '--enable-swresample',
    '--enable-decoder=ac3',
    '--enable-decoder=eac3',
    '--enable-decoder=dca',
    '--enable-decoder=truehd',
    '--enable-decoder=mlp',
    '--enable-libopus',
    '--enable-encoder=libopus',
    '--enable-demuxer=matroska',
    '--enable-demuxer=mov',
    '--enable-muxer=webm',
    '--extra-cflags=-I/build/opus/include',
    '--extra-ldflags=-L/build/opus/lib',
    '--pkg-config-flags=--static',
    '--pkg-config=sh /src/asbplayer/opus-pkg-config.sh',
    '--enable-parser=ac3',
    '--enable-parser=dca',
    '--enable-parser=mlp',
    '--nm=emnm',
    '--ar=emar',
    '--ranlib=emranlib',
    '--cc=emcc',
    '--cxx=em++',
    '--objcc=emcc',
    '--dep-cc=emcc',
];

const header = `#ifndef ASB_BUILD_CONFIG_HPP
#define ASB_BUILD_CONFIG_HPP

#define ASB_RUNTIME_VERSION ${JSON.stringify(runtimeVersion)}

#endif
`;
const dockerArguments = [
    `ASB_EMSDK_IMAGE=${config.toolchain.container}`,
    `ASB_INITIAL_MEMORY_BYTES=${positiveInteger('limits.initialMemoryBytes', config.limits.initialMemoryBytes)}`,
    `ASB_MAXIMUM_MEMORY_BYTES=${positiveInteger('limits.maximumMemoryBytes', config.limits.maximumMemoryBytes)}`,
    `ASB_STACK_BYTES=${positiveInteger('limits.stackBytes', config.limits.stackBytes)}`,
];

await mkdir(buildDirectory, { recursive: true });
await Promise.all([
    writeFile(resolve(buildDirectory, 'asb-build-config.hpp'), header),
    writeFile(resolve(buildDirectory, 'ffmpeg-configure-args'), `${ffmpegConfigureArguments.join('\n')}\n`),
    writeFile(resolve(buildDirectory, 'docker-build-args'), `${dockerArguments.join('\n')}\n`),
    writeFile(resolve(buildDirectory, 'platform'), `${config.toolchain.platform}\n`),
]);
