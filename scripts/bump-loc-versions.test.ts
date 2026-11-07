import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { bumpLocVersions, changedLocales, checkLocVersions, parseArgs } from './bump-loc-versions.ts';

const project = {
    name: 'test',
    languages: [
        { code: 'en', version: 1 },
        { code: 'ja', version: 2 },
    ],
};

test('flags a language whose strings changed without a version increment', (t) => {
    const { root, commit, baseSha, write } = repo(t);
    write('common/locales/ja.json', { action: { cancel: 'キャンセル' } });
    commit('second');

    assert.deepEqual(
        changedLocales(root, baseSha, 'HEAD').filter(({ deleted }) => !deleted),
        [{ code: 'ja', contentChanged: true, deleted: false }]
    );
    assert.deepEqual(checkLocVersions(root, baseSha, 'HEAD'), [
        'ja loc strings changed but the ja version did not increment (still 2); run pnpm bump:loc on main and merge it into this branch',
    ]);
    assert.deepEqual(checkLocVersions(root, baseSha, baseSha), []);
});

test('passes once the version increments, including for a new language file', (t) => {
    const { root, commit, baseSha, write, readPath } = repo(t);
    write('project.json', { ...project, languages: [...project.languages, { code: 'ko', version: 1 }] });
    write('common/locales/ko.json', { action: { cancel: '취소' } });
    commit('second');

    // ko has no deployed baseline yet, so a first version of 1 satisfies the check
    assert.deepEqual(checkLocVersions(root, baseSha, 'HEAD'), []);
    const configured = JSON.parse(readPath('project.json')).languages;
    assert.deepEqual(configured, [...project.languages, { code: 'ko', version: 1 }]);
});

test('ignores formatting-only locale changes', (t) => {
    const { root, commit, baseSha, append } = repo(t);
    append('common/locales/en.json', '\n');
    commit('newline-only');

    assert.deepEqual(changedLocales(root, baseSha, 'HEAD'), [{ code: 'en', contentChanged: false, deleted: false }]);
    assert.deepEqual(checkLocVersions(root, baseSha, 'HEAD'), []);
});

test('flags a changed locale that is not configured in project.json', (t) => {
    const { root, commit, baseSha, write } = repo(t);
    write('common/locales/xx.json', { action: { cancel: '取消' } });
    commit('second');

    const violations = checkLocVersions(root, baseSha, 'HEAD');
    assert.deepEqual(violations, ['xx loc strings changed but xx is not configured in project.json']);
});

test('bumps named languages in project.json', (t) => {
    const { root, write, readPath } = repo(t);

    assert.deepEqual(bumpLocVersions(root, undefined, ['ja', 'en']), [
        { code: 'ja', from: 2, to: 3 },
        { code: 'en', from: 1, to: 2 },
    ]);
    assert.deepEqual(JSON.parse(readPath('project.json')).languages, [
        { code: 'en', version: 2 },
        { code: 'ja', version: 3 },
    ]);
    assert.match(readPath('project.json'), /\n$/);
});

test('bumps languages whose strings changed against the base revision', (t) => {
    const { root, commit, baseSha, write, readPath } = repo(t);
    write('common/locales/ja.json', { action: { cancel: '取り消し' } });
    commit('second');

    assert.deepEqual(bumpLocVersions(root, baseSha, []), [{ code: 'ja', from: 2, to: 3 }]);
    assert.deepEqual(JSON.parse(readPath('project.json')).languages.find(({ code }) => code === 'ja').version, 3);
});

test('does not bump for formatting-only changes', (t) => {
    const { root, commit, baseSha, append, readPath } = repo(t);
    append('common/locales/ja.json', '\n');
    commit('newline-only');

    assert.deepEqual(bumpLocVersions(root, baseSha, []), []);
    assert.deepEqual(JSON.parse(readPath('project.json')).languages, project.languages);
    assert.equal(checkLocVersions(root, baseSha, 'HEAD').length, 0);
});

test('rejects unconfigured language codes', (t) => {
    const { root } = repo(t);
    assert.throws(() => bumpLocVersions(root, undefined, ['xx']), /xx is not configured/);
});

test('parses flags and rejects invalid combinations', () => {
    assert.deepEqual(parseArgs([]), { check: false, codes: [] });
    assert.deepEqual(parseArgs(['--check']), { check: true, codes: [] });
    assert.deepEqual(parseArgs(['--', '--check']), { check: true, codes: [] });
    assert.deepEqual(parseArgs(['--base', 'a', '--head', 'b', '--check']), {
        check: true,
        base: 'a',
        head: 'b',
        codes: [],
    });
    assert.deepEqual(parseArgs(['ja', 'en']), { check: false, codes: ['ja', 'en'] });
    assert.throws(() => parseArgs(['--check', 'ja']), /--check cannot be combined/);
    assert.throws(() => parseArgs(['--base']), /requires a value/);
});

function repo(t: import('node:test').TestContext) {
    const root = mkdtempSync(join(tmpdir(), 'asbplayer-loc-version-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    git('init', '--quiet', '-b', 'main');
    git('config', 'user.name', 'test');
    git('config', 'user.email', 'test@example.com');

    const path = (...segments: string[]) => join(root, ...segments);
    const write = (relativePath: string, value: unknown) => {
        mkdirSync(dirname(path(relativePath)), { recursive: true });
        writeFileSync(path(relativePath), `${JSON.stringify(value, null, 4)}\n`);
    };
    const append = (relativePath: string, suffix: string) =>
        writeFileSync(path(relativePath), `${readFileSync(path(relativePath), 'utf8')}${suffix}`);
    const readPath = (relativePath: string) => readFileSync(path(relativePath), 'utf8');
    const commit = (message: string) => {
        git('add', '-A');
        git('commit', '--quiet', '-m', message);
    };
    const writeBaseState = () => {
        write('project.json', project);
        write('common/locales/en.json', { action: { cancel: 'Cancel' } });
        write('common/locales/ja.json', { action: { cancel: 'やめる' } });
    };
    writeBaseState();
    commit('base');
    const baseSha = git('rev-parse', 'HEAD').trim();

    return { root, commit, baseSha, write, append, readPath };
}
