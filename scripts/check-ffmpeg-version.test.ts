import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { checkFfmpegVersion } from './check-ffmpeg-version.ts';

function fixture(t: TestContext, version: unknown) {
    const root = mkdtempSync(join(tmpdir(), 'asbplayer-ffmpeg-version-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const writeVersion = (value: unknown) =>
        writeFileSync(join(root, 'project.json'), JSON.stringify({ artifacts: { ffmpeg: { version: value } } }));
    writeVersion(version);
    const git = (...args: string[]) =>
        execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args], {
            cwd: root,
            encoding: 'utf8',
            env: {
                ...process.env,
                GIT_AUTHOR_NAME: 'Version test',
                GIT_AUTHOR_EMAIL: 'version@example.com',
                GIT_COMMITTER_NAME: 'Version test',
                GIT_COMMITTER_EMAIL: 'version@example.com',
            },
        }).trim();
    const commit = () => {
        git('add', '--all');
        git('commit', '-qm', 'Update fixture');
    };
    return { root, writeVersion, git, commit };
}

test('accepts canonical 0.X.Y versions without requiring Git history for a format check', (t) => {
    const { root, writeVersion } = fixture(t, '0.0.0');
    for (const version of ['0.0.0', '0.3.4', '0.10.123', '0.9007199254740993.0']) {
        writeVersion(version);
        assert.doesNotThrow(() => checkFfmpegVersion(root), version);
    }
});

test('rejects missing, malformed, nonzero-major, padded, and suffixed versions', (t) => {
    const { root, writeVersion } = fixture(t, '0.0.0');
    for (const version of [
        undefined,
        null,
        0,
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
        writeVersion(version);
        assert.throws(() => checkFfmpegVersion(root), /must be 0\.X\.Y/, String(version));
    }
});

test('allows only an unchanged version, the next Y, or the next X with Y reset', (t) => {
    const { root, writeVersion, git, commit } = fixture(t, '0.3.4');
    git('init', '-q', '-b', 'main');
    commit();
    // The selected published runtime can lag behind the development version.
    mkdirSync(join(root, 'ffmpeg'));
    writeFileSync(join(root, 'ffmpeg/artifact-lock.json'), JSON.stringify({ runtimeVersion: '0.1.0' }));
    for (const version of ['0.3.4', '0.3.5', '0.4.0']) {
        writeVersion(version);
        assert.doesNotThrow(() => checkFfmpegVersion(root, 'HEAD'), version);
    }
    for (const version of ['0.3.3', '0.3.0', '0.2.5', '0.3.6', '0.4.1', '0.5.0']) {
        writeVersion(version);
        assert.throws(() => checkFfmpegVersion(root, 'HEAD'), /0\.3\.4 -> .* is invalid/, version);
    }
});

test('increments large components exactly without rounding', (t) => {
    const { root, writeVersion, git, commit } = fixture(t, '0.9007199254740992.9007199254740992');
    git('init', '-q', '-b', 'main');
    commit();
    for (const version of ['0.9007199254740992.9007199254740993', '0.9007199254740993.0']) {
        writeVersion(version);
        assert.doesNotThrow(() => checkFfmpegVersion(root, 'HEAD'), version);
    }
    writeVersion('0.9007199254740992.9007199254740994');
    assert.throws(() => checkFfmpegVersion(root, 'HEAD'), /is invalid/);
});

test('compares the whole branch against its merge base rather than the previous commit or base tip', (t) => {
    const { root, writeVersion, git, commit } = fixture(t, '0.3.4');
    git('init', '-q', '-b', 'main');
    commit();
    git('checkout', '-qb', 'feature');
    writeVersion('0.3.5');
    commit();
    writeVersion('0.3.6');
    commit();
    assert.throws(() => checkFfmpegVersion(root, 'main'), /0\.3\.4 -> 0\.3\.6 is invalid/);

    writeVersion('0.3.5');
    commit();
    git('checkout', '-q', 'main');
    writeVersion('0.8.0');
    commit();
    git('checkout', '-q', 'feature');
    assert.doesNotThrow(() => checkFfmpegVersion(root, 'main'));
    // CI must compare the PR's version, without inheriting later target-branch bumps.
    git('checkout', '-qb', 'ci-merge', 'main');
    git('merge', '--no-ff', '-s', 'ours', 'feature', '-m', 'Synthetic PR merge');
    assert.doesNotThrow(() => checkFfmpegVersion(root, 'main', 'feature'));
});

test('uses the actual PR head to find the merge base when CI checks out a synthetic merge', (t) => {
    const { root, writeVersion, git, commit } = fixture(t, '0.3.4');
    git('init', '-q', '-b', 'main');
    commit();
    git('checkout', '-qb', 'feature');
    writeVersion('0.3.6');
    commit();
    git('checkout', '-q', 'main');
    writeVersion('0.3.5');
    commit();
    git('checkout', '-qb', 'ci-merge');
    git('merge', '--no-ff', '-X', 'theirs', 'feature', '-m', 'Synthetic PR merge');
    assert.throws(() => checkFfmpegVersion(root, 'main', 'feature'), /0\.3\.4 -> 0\.3\.6 is invalid/);
});

test('allows introduction of the version when the baseline has no FFmpeg version or project file', (t) => {
    const { root, writeVersion, git, commit } = fixture(t, undefined);
    git('init', '-q', '-b', 'main');
    commit();
    writeVersion('0.0.0');
    assert.doesNotThrow(() => checkFfmpegVersion(root, 'HEAD'));
    rmSync(join(root, 'project.json'));
    writeFileSync(join(root, 'README.md'), 'Before project configuration\n');
    commit();
    writeVersion('0.0.0');
    assert.doesNotThrow(() => checkFfmpegVersion(root, 'HEAD'));
    writeVersion('1.0.0');
    assert.throws(() => checkFfmpegVersion(root, 'HEAD'), /must be 0\.X\.Y/);
});

test('does not silently skip a comparison when the baseline reference is empty or unavailable', (t) => {
    const { root, git, commit } = fixture(t, '0.0.0');
    git('init', '-q', '-b', 'main');
    commit();
    assert.throws(() => checkFfmpegVersion(root, ''), /nonempty Git references/);
    assert.throws(() => checkFfmpegVersion(root, 'missing-branch'));
});
