import { execFileSync } from 'node:child_process';
import { realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    DOCS_I18N_DIR,
    DOCS_SOURCE_DIR,
    localeTreeDir,
    localesForProject,
    readOptional,
    walkFiles,
} from './docs-i18n-files.ts';

export type WorklistFile = { file: string; reason: 'untranslated' | 'changed' };

export type Worklist = {
    translate: { locale: string; files: WorklistFile[] }[];
    deleted: { locale: string; files: string[] }[];
    sidebar: string[];
};

/**
 * One git pass maps every docs file to the newest commit touching it. The
 * worklist runs in the docs-translate workflow (fetch-depth 0) where history
 * is complete; uncommitted working-tree changes are deliberately ignored.
 */
function lastCommits(root: string): Map<string, string> {
    const log = execFileSync(
        'git',
        ['log', '--format=%H', '--name-only', '--no-renames', '--', DOCS_SOURCE_DIR, DOCS_I18N_DIR],
        { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
    const commits = new Map<string, string>();
    let commit = '';
    for (const line of log.split('\n')) {
        if (/^[0-9a-f]{40}$/.test(line)) {
            commit = line;
        } else {
            const file = line.trim();
            if (file !== '' && !commits.has(file)) commits.set(file, commit);
        }
    }
    return commits;
}

/** True when the English source was touched in a commit after the locale file's last commit. */
function englishChangedSinceTranslation(
    root: string,
    localeCommit: string | undefined,
    englishCommit: string | undefined
): boolean {
    // An English file with no commit is newer than any translation state.
    if (englishCommit === undefined) return true;
    if (localeCommit === undefined) return false;
    if (localeCommit === englishCommit) return false;
    try {
        execFileSync('git', ['merge-base', '--is-ancestor', localeCommit, englishCommit], {
            cwd: root,
            stdio: 'ignore',
        });
        return true;
    } catch {
        return false;
    }
}

/** Sidebar labels are untranslated while any category value still equals its English label. */
function sidebarLabelsPending(root: string, locale: string, englishLabels: Set<string>): boolean {
    const current = readOptional(join(root, DOCS_I18N_DIR, locale, 'docusaurus-plugin-content-docs', 'current.json'));
    if (current === undefined) return true;
    const translations = JSON.parse(current) as Record<string, { message: string }>;
    return Object.entries(translations).some(
        ([key, value]) => key.startsWith('sidebar.') && key.includes('.category.') && englishLabels.has(value.message)
    );
}

/** Diff of the locale trees against the current English sources and git history. */
export function computeWorklist(root: string, locales: string[]): Worklist {
    const sourceFiles = walkFiles(join(root, DOCS_SOURCE_DIR)) ?? [];
    const sources = new Map(sourceFiles.map((file) => [file, readOptional(join(root, DOCS_SOURCE_DIR, file)) ?? '']));
    const englishLabels = new Set(
        sourceFiles
            .filter((file) => file.endsWith('_category_.json'))
            .map((file) => (JSON.parse(sources.get(file)!) as { label?: string }).label)
    );
    const commits = lastCommits(root);

    const worklist: Worklist = { translate: [], deleted: [], sidebar: [] };
    for (const locale of locales) {
        const treeDir = join(root, localeTreeDir(locale));
        const treeFiles = walkFiles(treeDir) ?? [];

        const files: WorklistFile[] = [];
        for (const file of sourceFiles) {
            // JSON metadata is structural and kept in sync by pnpm sync:project.
            if (file.endsWith('.json')) continue;
            const translated = readOptional(join(treeDir, file));
            if (translated === undefined || translated === sources.get(file)) {
                // Missing or byte-identical to English: the seeded, untranslated state.
                files.push({ file, reason: 'untranslated' });
            } else if (
                englishChangedSinceTranslation(
                    root,
                    commits.get(`${localeTreeDir(locale)}/${file}`),
                    commits.get(`${DOCS_SOURCE_DIR}/${file}`)
                )
            ) {
                files.push({ file, reason: 'changed' });
            }
        }
        if (files.length > 0) worklist.translate.push({ locale, files });

        const stale = treeFiles.filter((file) => !sourceFiles.includes(file));
        if (stale.length > 0) worklist.deleted.push({ locale, files: stale });

        if (sidebarLabelsPending(root, locale, englishLabels)) worklist.sidebar.push(locale);
    }
    return worklist;
}

export function worklistIsEmpty(worklist: Worklist): boolean {
    return worklist.translate.length === 0 && worklist.deleted.length === 0 && worklist.sidebar.length === 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const configured = localesForProject(root);
    const localeArg = /^--locales=(.+)$/.exec(process.argv.slice(2).find((arg) => arg.startsWith('--locales=')) ?? '');
    const locales = localeArg
        ? localeArg[1]
              .split(',')
              .map((locale) => locale.trim())
              .filter(Boolean)
        : configured;
    for (const locale of locales) {
        if (!configured.includes(locale)) {
            console.error(`Locale "${locale}" is not configured in project.json`);
            process.exit(1);
        }
    }
    if (process.argv.includes('--print-locales')) {
        console.log(configured.join(' '));
    } else {
        const worklist = computeWorklist(root, locales);
        if (worklistIsEmpty(worklist)) {
            console.log('Docs translations are up to date.');
        } else {
            for (const { locale, files } of worklist.translate) {
                console.log(`translate ${locale}: ${files.map((entry) => entry.file).join(', ')}`);
            }
            for (const { locale, files } of worklist.deleted) {
                console.log(`delete ${locale}: ${files.join(', ')}`);
            }
            if (worklist.sidebar.length > 0) {
                console.log(`sidebar labels: ${worklist.sidebar.join(', ')}`);
            }
            const outPath = join(root, 'translation-worklist.json');
            writeFileSync(outPath, `${JSON.stringify(worklist, null, 4)}\n`);
            console.log(`wrote ${outPath}`);
            // The agent reads the file above; --check exits non-zero for manual drift checks.
            if (process.argv.includes('--check')) {
                console.error('Docs translations are stale; run the docs-translate workflow.');
                process.exitCode = 1;
            }
        }
    }
}
