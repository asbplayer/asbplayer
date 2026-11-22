import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { localeTreeDir } from './docs-i18n-files.ts';
import { computeWorklist, worklistIsEmpty } from './docs-translation-worklist.ts';

type Repo = { root: string; write: (path: string, contents: string) => void; commit: (message: string) => void };

function repo(t: { after: (fn: () => void) => void }): Repo {
    const root = mkdtempSync(join(tmpdir(), 'asbplayer-worklist-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root });
    git('init');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    const write = (path: string, contents: string) => {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), contents);
    };
    const commit = (message: string) => {
        git('add', '-A');
        execFileSync('git', ['commit', '--allow-empty', '-m', message], { cwd: root, stdio: 'ignore' });
    };
    return { root, write, commit };
}

test('flags seeded English copies as untranslated, including files missing from the tree', (t) => {
    const { root, write, commit } = repo(t);
    write('docs/docs/page.md', 'English source.\n');
    commit('add English');
    write(`${localeTreeDir('de')}/page.md`, 'English source.\n');
    commit('seed de');

    const worklist = computeWorklist(root, ['de', 'ja']);
    assert.deepEqual(worklist.translate, [
        { locale: 'de', files: [{ file: 'page.md', reason: 'untranslated' }] },
        { locale: 'ja', files: [{ file: 'page.md', reason: 'untranslated' }] },
    ]);
});

test('treats a differing translation of the current source as up to date, and as changed once English moves', (t) => {
    const { root, write, commit } = repo(t);
    write('docs/docs/page.md', 'English source.\n');
    write(`${localeTreeDir('de')}/page.md`, 'Deutsche Übersetzung.\n');
    commit('translate');

    assert.deepEqual(computeWorklist(root, ['de']).translate, []);

    write('docs/docs/page.md', 'Changed English source.\n');
    commit('edit English');
    assert.deepEqual(computeWorklist(root, ['de']).translate, [
        { locale: 'de', files: [{ file: 'page.md', reason: 'changed' }] },
    ]);
});

test('lists locale files whose English source was deleted', (t) => {
    const { root, write, commit } = repo(t);
    write(`${localeTreeDir('de')}/gone.md`, 'No English source.\n');
    commit('locale-only');
    assert.deepEqual(computeWorklist(root, ['de']).deleted, [{ locale: 'de', files: ['gone.md'] }]);
});

test('flags sidebar labels while any category value equals its English label', (t) => {
    const { root, write, commit } = repo(t);
    write('docs/docs/guides/_category_.json', '{"label": "Guides"}\n');
    write('docs/docs/page.md', 'English source.\n');
    write(`${localeTreeDir('de')}/page.md`, 'Deutsche Übersetzung.\n');
    write(
        'docs/i18n/de/docusaurus-plugin-content-docs/current.json',
        '{"sidebar.tutorialSidebar.category.Guides": {"message": "Guides"}}\n'
    );
    commit('skeleton');
    assert.deepEqual(computeWorklist(root, ['de']).sidebar, ['de']);

    write(
        'docs/i18n/de/docusaurus-plugin-content-docs/current.json',
        '{"sidebar.tutorialSidebar.category.Guides": {"message": "Anleitungen"}}\n'
    );
    commit('translate labels');
    assert.deepEqual(computeWorklist(root, ['de']).sidebar, []);
});

test('theme strings are pending until committed clean, and again when dirtied', (t) => {
    const { root, write, commit } = repo(t);
    write('docs/docs/page.md', 'English source.\n');
    write(`${localeTreeDir('de')}/page.md`, 'Deutsche Übersetzung.\n');
    commit('translated docs');
    assert.deepEqual(computeWorklist(root, ['de']).theme, ['de']);

    write('docs/i18n/de/code.json', '{"a.message": {"message": "A"}}\n');
    write('docs/i18n/de/docusaurus-theme-classic/navbar.json', '{}\n');
    write('docs/i18n/de/docusaurus-theme-classic/footer.json', '{}\n');
    write('docs/i18n/de/docusaurus-plugin-content-blog/options.json', '{}\n');
    commit('theme');
    assert.deepEqual(computeWorklist(root, ['de']).theme, []);

    // A regenerated skeleton with new keys shows up as a working-tree change,
    // the same way write-translations dirties committed files after a config edit.
    write('docs/i18n/de/code.json', '{"a.message": {"message": "A"}, "b.message": {"message": "B"}}\n');
    assert.deepEqual(computeWorklist(root, ['de']).theme, ['de']);
});

test('a fully translated, in-sync tree produces an empty worklist', (t) => {
    const { root, write, commit } = repo(t);
    write('docs/docs/page.md', 'English source.\n');
    write(`${localeTreeDir('de')}/page.md`, 'Deutsche Übersetzung.\n');
    write('docs/docs/guides/_category_.json', '{"label": "Guides"}\n');
    write(
        'docs/i18n/de/docusaurus-plugin-content-docs/current.json',
        '{"sidebar.tutorialSidebar.category.Guides": {"message": "Anleitungen"}}\n'
    );
    write('docs/i18n/de/code.json', '{}\n');
    write('docs/i18n/de/docusaurus-theme-classic/navbar.json', '{}\n');
    write('docs/i18n/de/docusaurus-theme-classic/footer.json', '{}\n');
    write('docs/i18n/de/docusaurus-plugin-content-blog/options.json', '{}\n');
    commit('translated');
    assert.equal(worklistIsEmpty(computeWorklist(root, ['de'])), true);
});
