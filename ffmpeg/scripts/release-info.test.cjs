/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { promisify } = require('node:util');

const exec = promisify(execFile);
let repositoryRoot;
let root;
let lockPath;
const releaseConfig = {
    releaseTitle: 'Runtime {{version}} ({{version}})',
    releaseTag: 'custom-{{version}}',
    artifact: 'binary-{{version}}',
    sources: 'upstream-{{version}}',
};
const writeVersion = (runtimeVersion) => writeFile(lockPath, JSON.stringify({ runtimeVersion }));
const run = (args = [], env = {}) =>
    exec(process.execPath, [resolve(root, 'scripts/release-info.mjs'), ...args], {
        env: { ...process.env, ASB_FFMPEG_RUNTIME_VERSION: undefined, ...env },
    });

beforeEach(async () => {
    repositoryRoot = await mkdtemp(resolve(tmpdir(), 'asbplayer-release-info-'));
    root = resolve(repositoryRoot, 'ffmpeg');
    lockPath = resolve(root, 'artifact-lock.json');
    await mkdir(resolve(root, 'scripts'), { recursive: true });
    for (const script of ['runtime-version.mjs', 'release-names.mjs', 'release-info.mjs']) {
        await copyFile(resolve(__dirname, script), resolve(root, 'scripts', script));
    }
    await writeFile(resolve(repositoryRoot, 'project.json'), JSON.stringify({ releases: { ffmpeg: releaseConfig } }));
    await writeFile(resolve(root, 'package.json'), JSON.stringify({ type: 'module', version: '9.9.9' }));
    await writeVersion('0.3.4');
});
afterEach(async () => {
    await rm(repositoryRoot, { recursive: true, force: true });
});

it('uses the locked version for all release templates independently of the package version', async () => {
    expect((await run()).stdout).toBe(
        'version=0.3.4\ntag=custom-0.3.4\ntitle=Runtime 0.3.4 (0.3.4)\nruntimeArchive=binary-0.3.4.tar.gz\nsourcesArchive=upstream-0.3.4.tar.gz\nsourcesRoot=upstream-0.3.4\n'
    );
    expect((await run(['runtimeArchive'])).stdout).toBe('binary-0.3.4.tar.gz\n');
});

it.each([
    ['0.0.0', 'patch', '0.0.1'],
    ['0.0.0', 'minor', '0.1.0'],
    ['0.3.4', 'patch', '0.3.5'],
    ['0.3.4', 'minor', '0.4.0'],
    ['0.9007199254740992.9007199254740992', 'patch', '0.9007199254740992.9007199254740993'],
    ['0.9007199254740992.9007199254740992', 'minor', '0.9007199254740993.0'],
])('bumps locked %s by %s to %s without changing the lock', async (current, bump, expected) => {
    await writeVersion(current);
    const lock = await readFile(lockPath, 'utf8');
    const output = (await run(['--bump', bump])).stdout;
    expect(output).toContain(`version=${expected}\n`);
    expect(output).toContain(`tag=custom-${expected}\n`);
    expect(output).toContain(`runtimeArchive=binary-${expected}.tar.gz\n`);
    expect(await readFile(lockPath, 'utf8')).toBe(lock);
});

it('uses a build override for release metadata while always calculating bumps from the lock', async () => {
    const env = { ASB_FFMPEG_RUNTIME_VERSION: '0.4.0' };
    expect((await run(['version'], env)).stdout).toBe('0.4.0\n');
    expect((await run(['version', '--bump', 'patch'], env)).stdout).toBe('0.3.5\n');
});

it.each(['major', 'none', ''])('rejects unsupported release bump %j', async (bump) => {
    await expect(run(['--bump', bump])).rejects.toThrow('must be patch or minor');
});

it('rejects missing and noncanonical locked versions before producing metadata', async () => {
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
        await writeVersion(version);
        await expect(run()).rejects.toThrow('FFmpeg runtime version must be 0.X.Y');
    }
});

it('rejects a noncanonical release build override', async () => {
    await expect(run([], { ASB_FFMPEG_RUNTIME_VERSION: '0.3.4-rc.1' })).rejects.toThrow(
        'FFmpeg runtime version must be 0.X.Y'
    );
});
