/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { promisify } = require('node:util');
const config = require('../build-config.json');

const exec = promisify(execFile);
let repositoryRoot;
let temporary;
let configuration;
beforeEach(async () => {
    repositoryRoot = await mkdtemp(join(tmpdir(), 'asbplayer-build-inputs-'));
    temporary = join(repositoryRoot, 'ffmpeg');
    await mkdir(join(temporary, 'scripts'), { recursive: true });
    for (const script of ['lib.mjs', 'runtime-version.mjs', 'release-names.mjs', 'generate-build-inputs.mjs']) {
        await copyFile(join(__dirname, script), join(temporary, 'scripts', script));
    }
    configuration = structuredClone(config);
    await writeFile(join(temporary, 'package.json'), JSON.stringify({ version: '9.9.9' }));
    await writeFile(join(temporary, 'artifact-lock.json'), JSON.stringify({ runtimeVersion: '0.2.3' }));
    await writeFile(
        join(repositoryRoot, 'project.json'),
        JSON.stringify({
            version: '7.0.0',
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
});
afterEach(async () => {
    await rm(repositoryRoot, { recursive: true, force: true });
});
const generate = async (env = {}) => {
    await writeFile(join(temporary, 'build-config.json'), JSON.stringify(configuration));
    return exec(process.execPath, [join(temporary, 'scripts/generate-build-inputs.mjs')], {
        env: { ...process.env, ASB_FFMPEG_RUNTIME_VERSION: undefined, ...env },
    });
};

it('generates compiler inputs using the locked runtime version independently of package and extension versions', async () => {
    await generate();
    const output = join(temporary, '.cache/build');
    expect(await readFile(join(output, 'asb-build-config.hpp'), 'utf8')).toContain(
        '#define ASB_RUNTIME_VERSION "0.2.3"'
    );
    expect(await readFile(join(output, 'platform'), 'utf8')).toBe(`${config.toolchain.platform}\n`);
    const dockerArguments = await readFile(join(output, 'docker-build-args'), 'utf8');
    expect(dockerArguments.trim().split('\n')).toEqual([
        `ASB_EMSDK_IMAGE=${config.toolchain.container}`,
        `ASB_INITIAL_MEMORY_BYTES=${config.limits.initialMemoryBytes}`,
        `ASB_MAXIMUM_MEMORY_BYTES=${config.limits.maximumMemoryBytes}`,
        `ASB_STACK_BYTES=${config.limits.stackBytes}`,
    ]);
    const flags = (await readFile(join(output, 'ffmpeg-configure-args'), 'utf8')).trim().split('\n');
    expect(flags).toEqual(
        expect.arrayContaining(['--disable-all', '--disable-autodetect', '--disable-pthreads', '--enable-version3'])
    );
    expect(
        flags.some(
            (flag) =>
                flag.startsWith('--enable-') &&
                !['--enable-cross-compile', '--enable-small', '--enable-version3'].includes(flag)
        )
    ).toBe(false);
});

it('stamps the release version override into compiler inputs without changing the lock', async () => {
    const lockPath = join(temporary, 'artifact-lock.json');
    const lock = await readFile(lockPath, 'utf8');
    await generate({ ASB_FFMPEG_RUNTIME_VERSION: '0.3.0' });
    expect(await readFile(join(temporary, '.cache/build/asb-build-config.hpp'), 'utf8')).toContain(
        '#define ASB_RUNTIME_VERSION "0.3.0"'
    );
    expect(await readFile(lockPath, 'utf8')).toBe(lock);
});

it.each([
    ['initialMemoryBytes', 0],
    ['maximumMemoryBytes', -1],
    ['stackBytes', Number.MAX_SAFE_INTEGER + 1],
])('rejects invalid %s before producing compiler inputs', async (field, value) => {
    configuration.limits[field] = value;
    await expect(generate()).rejects.toThrow('positive safe integer');
});
