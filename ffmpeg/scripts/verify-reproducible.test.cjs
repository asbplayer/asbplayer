/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { execFile } = require('node:child_process');
const { copyFile, cp, mkdir, mkdtemp, rename, rm, symlink, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { promisify } = require('node:util');

const exec = promisify(execFile);
const version = '0.1.0';
let temporary;
let root;
let reference;
let bin;

beforeEach(async () => {
    temporary = await mkdtemp(join(tmpdir(), 'asbplayer-reproduce-'));
    root = join(temporary, 'source');
    reference = join(temporary, 'reference');
    bin = join(temporary, 'bin');
    await mkdir(join(root, 'ffmpeg/scripts'), { recursive: true });
    await mkdir(join(root, 'ffmpeg/native'), { recursive: true });
    await mkdir(join(reference, 'dist'), { recursive: true });
    await mkdir(join(reference, 'release'), { recursive: true });
    await mkdir(bin);
    for (const script of [
        'lib.mjs',
        'github-release.mjs',
        'verify-reproducible.sh',
        'release-info.mjs',
        'release-names.mjs',
        'runtime-version.mjs',
    ]) {
        await copyFile(join(__dirname, script), join(root, 'ffmpeg/scripts', script));
    }
    await writeFile(
        join(root, 'project.json'),
        JSON.stringify({
            releases: {
                ffmpeg: {
                    releaseTitle: 'ffmpeg-{{version}}',
                    releaseTag: 'ffmpeg-v{{version}}',
                    artifact: 'ffmpeg-{{version}}-runtime',
                    sources: 'ffmpeg-{{version}}-sources',
                },
            },
        })
    );
    await writeFile(join(root, 'ffmpeg/artifact-lock.json'), JSON.stringify({ runtimeVersion: version }));
    await writeFile(join(root, 'ffmpeg/native/source with spaces.cpp'), 'original source');
    await writeFile(join(root, 'ffmpeg/native/deleted.cpp'), 'deleted source');
    await writeFile(join(root, 'ffmpeg/native/before rename.cpp'), 'renamed source');
    await writeFile(join(root, 'ffmpeg/native/source\nwith newline.cpp'), 'newline source');
    await symlink('missing.cpp', join(root, 'ffmpeg/native/dangling-link.cpp'));
    await writeFile(join(root, '.gitignore'), 'node_modules/\n/ffmpeg/.cache/\n/ffmpeg/dist/\n/ffmpeg/release/\n');
    for (const filename of ['ffmpeg-core.js', 'ffmpeg-core.wasm', 'ffmpeg-worker.js', 'manifest.json']) {
        await writeFile(join(reference, 'dist', filename), filename);
    }
    const sourcesRoot = `ffmpeg-${version}-sources`;
    await mkdir(join(temporary, sourcesRoot));
    await writeFile(join(temporary, sourcesRoot, 'upstream.tar.gz'), 'verified upstream tarball');
    await exec('tar', ['-czf', join(reference, 'release', `${sourcesRoot}.tar.gz`), '-C', temporary, sourcesRoot]);
    await writeFile(join(reference, 'release', `ffmpeg-${version}-runtime.tar.gz`), 'runtime archive');
    await cp(join(reference, 'dist'), join(root, 'ffmpeg/dist', version), { recursive: true });
    await cp(join(reference, 'release'), join(root, 'ffmpeg/release'), { recursive: true });
    for (const directory of ['node_modules', 'ffmpeg/node_modules', 'ffmpeg/.cache']) {
        await mkdir(join(root, directory), { recursive: true });
        await writeFile(join(root, directory, 'stale'), 'must not reach the clean build');
    }
    // Replace only dependency installation and Docker-backed builds; snapshotting, extraction,
    // and byte comparisons use the real shell, Git, tar, cmp, and diff commands.
    await writeFile(
        join(bin, 'pnpm'),
        `#!/bin/bash
set -euo pipefail
case "$*" in
    'install --frozen-lockfile --filter @project/ffmpeg')
        test ! -e node_modules
        test ! -e ffmpeg/node_modules
        test ! -e ffmpeg/.cache/stale
        test ! -e ffmpeg/dist
        test ! -e ffmpeg/release
        test "$(cat 'ffmpeg/native/source with spaces.cpp')" = 'current source'
        test -f ffmpeg/native/extra.cpp
        test ! -e ffmpeg/native/deleted.cpp
        test ! -e 'ffmpeg/native/before rename.cpp'
        test "$(cat 'ffmpeg/native/after rename.cpp')" = 'renamed source'
        test "$(cat 'ffmpeg/native/source\nwith newline.cpp')" = 'newline source'
        test -L ffmpeg/native/dangling-link.cpp
        test "$(cat ffmpeg/.cache/archives/upstream.tar.gz)" = 'verified upstream tarball'
        ;;
    '--filter @project/ffmpeg run build:candidate')
        mkdir -p ffmpeg/dist/${version} ffmpeg/release
        cp "$TEST_REFERENCE"/dist/* ffmpeg/dist/${version}/
        cp "$TEST_REFERENCE"/release/* ffmpeg/release/
        if [[ "$TEST_MISMATCH" == '1' ]]; then
            echo changed > ffmpeg/dist/${version}/ffmpeg-core.wasm
        fi
        ;;
    '--filter @project/ffmpeg run test:native-wasm') ;;
    *) exit 2 ;;
esac
`,
        { mode: 0o755 }
    );
});

afterEach(async () => {
    await rm(temporary, { recursive: true, force: true });
});

const updateSources = async () => {
    await writeFile(join(root, 'ffmpeg/native/source with spaces.cpp'), 'current source');
    await writeFile(join(root, 'ffmpeg/native/extra.cpp'), 'untracked source');
    await rm(join(root, 'ffmpeg/native/deleted.cpp'));
    await rename(join(root, 'ffmpeg/native/before rename.cpp'), join(root, 'ffmpeg/native/after rename.cpp'));
};

const reproduce = (env = {}) =>
    exec('bash', [join(root, 'ffmpeg/scripts/verify-reproducible.sh')], {
        env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            ASB_FFMPEG_RUNTIME_VERSION: undefined,
            TEST_REFERENCE: reference,
            TEST_MISMATCH: '0',
            ...env,
        },
    });

it.each(['Git checkout', 'source archive'])('rebuilds clean inputs from a %s', async (kind) => {
    if (kind === 'Git checkout') {
        await exec('git', ['init', '-q', root]);
        await exec('git', ['-C', root, 'add', '.']);
    }
    await updateSources();
    const { stdout } = await reproduce();
    expect(stdout).toContain('The published source reproduces the FFmpeg release');
});

it('rejects a source archive rebuild whose runtime bytes differ', async () => {
    await updateSources();
    await expect(reproduce({ TEST_MISMATCH: '1' })).rejects.toMatchObject({
        code: 1,
        stdout: expect.stringContaining('ffmpeg-core.wasm'),
    });
});
