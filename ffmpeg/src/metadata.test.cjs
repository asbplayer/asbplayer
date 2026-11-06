/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const load = (definitions) =>
    JSON.parse(
        execFileSync(
            process.execPath,
            [
                '--input-type=module',
                '-e',
                `
    Object.assign(globalThis, ${JSON.stringify(definitions)});
    const { ffmpegMetadata } = await import(${JSON.stringify(pathToFileURL(resolve(__dirname, 'metadata.ts')).href)});
    console.log(JSON.stringify(ffmpegMetadata));
`,
            ],
            { encoding: 'utf8', stdio: 'pipe' }
        )
    );

it.each([
    [{}, '__ASB_FFMPEG_RUNTIME_VERSION__'],
    [{ __ASB_FFMPEG_RUNTIME_VERSION__: '0.9.0' }, '__ASB_FFMPEG_VERSION__'],
])('rejects missing build definitions instead of filling them from the selected lock: %j', (definitions, missing) => {
    expect(() => load(definitions)).toThrow(`${missing} is not defined`);
});

it('uses the complete build selection, including a candidate archive different from the lock', () => {
    const archive = { url: '/candidate/runtime.tgz', sha256: '1'.repeat(64), bytes: 123 };
    expect(
        load({
            __ASB_FFMPEG_RUNTIME_VERSION__: '0.9.0',
            __ASB_FFMPEG_VERSION__: '10.0',
            __ASB_FFMPEG_RUNTIME_ARCHIVE__: archive,
        })
    ).toEqual({ runtimeVersion: '0.9.0', ffmpegVersion: '10.0', runtimeArchive: archive });
});
