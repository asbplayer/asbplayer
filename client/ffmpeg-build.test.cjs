/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { resolve } = require('node:path');
const { promisify } = require('node:util');
const { pathToFileURL } = require('node:url');

const exec = promisify(execFile);
const configure = async (options) => {
    const { stdout } = await exec(process.execPath, [
        '--input-type=module',
        '-e',
        `import { createFfmpegBuildConfig } from ${JSON.stringify(pathToFileURL(resolve(__dirname, 'ffmpeg-build.ts')).href)};
        globalThis.fetch = () => { throw new Error('Unexpected download'); };
        console.log(JSON.stringify(await createFfmpegBuildConfig(${JSON.stringify(options)})));`,
    ]);
    return JSON.parse(stdout);
};

it('previews an existing build without downloading inputs again', async () => {
    const result = await configure({ candidate: false, prepare: false, base: '/nested' });
    expect(result.copyTargets).toEqual([]);
    expect(JSON.parse(result.define.__ASB_FFMPEG_RUNTIME_ARCHIVE__).url).toBe('/nested/ffmpeg/runtime.tgz');
});
