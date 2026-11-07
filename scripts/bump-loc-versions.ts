import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncProjectConfig } from './sync-project-config.ts';

// Increment per-language loc versions in project.json. The versions are served through
// common/extension.json, and existing extension installs re-download <lang>.json strings
// only while the deployed version exceeds their bundled one, so bumps must follow every
// deployed string change.

type Args = { check: boolean; base?: string; head?: string; codes: string[] };

export function parseArgs(argv: string[]): Args {
    const args: Args = { check: false, codes: [] };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--check':
                args.check = true;
                break;
            case '--base':
                args.base = nextValue(argv, ++i, arg);
                break;
            case '--head':
                args.head = nextValue(argv, ++i, arg);
                break;
            // npm forwards a literal -- separator; pnpm accepts the flag directly
            case '--':
                break;
            default:
                if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
                args.codes.push(arg);
        }
    }
    if (args.check && args.codes.length > 0) {
        throw new Error('--check cannot be combined with named language codes');
    }
    return args;
}

function nextValue(argv: string[], index: number, flag: string): string {
    if (index >= argv.length) throw new Error(`${flag} requires a value`);
    return argv[index];
}

function git(root: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function resolveRevision(root: string, ref: string): string {
    try {
        const sha = git(root, 'rev-parse', '--verify', '--quiet', ref).trim();
        if (sha.length > 0) return sha;
    } catch {
        // fall through to the error below
    }
    throw new Error(`Revision ${ref} is not available; run git fetch origin`);
}

function mergeBaseOf(root: string, base: string, head: string): string {
    return git(root, 'merge-base', base, head).trim();
}

// Revisions are validated upfront, so a missing file here means it does not exist there.
function fileAt(root: string, rev: string, path: string): string | undefined {
    try {
        return git(root, 'show', `${rev}:${path}`);
    } catch {
        return undefined;
    }
}

function projectAt(root: string, rev: string): { languages?: Array<{ code: string; version?: number }> } {
    const contents = fileAt(root, rev, 'project.json');
    return contents === undefined ? {} : JSON.parse(contents);
}

function versionsOf(project: { languages?: Array<{ code: string; version?: number }> }): Map<string, number> {
    return new Map((project.languages ?? []).map(({ code, version }) => [code, version]));
}

// Compare parsed JSON so formatting-only changes (trailing newlines, key reordering,
// indentation churn) never demand a version bump.
function canonicalJson(value: unknown): string {
    const sort = (element: unknown): unknown => {
        if (Array.isArray(element)) return element.map(sort);
        if (element !== null && typeof element === 'object') {
            return Object.fromEntries(
                Object.entries(element)
                    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                    .map(([key, child]) => [key, sort(child)])
            );
        }
        return element;
    };
    return JSON.stringify(sort(value));
}

export type LocaleChange = { code: string; contentChanged: boolean; deleted: boolean };

// One entry per changed locale file between the merge base of base/head and head. Diffing
// the merge base rather than base itself keeps commits already deployed on the base branch
// out of later deploy ranges.
export function changedLocales(root: string, base: string, head: string): LocaleChange[] {
    const mergeBase = mergeBaseOf(root, base, head);
    const paths = git(root, 'diff', '--name-only', '--no-renames', mergeBase, head, '--', 'common/locales')
        .trim()
        .split('\n')
        .filter(Boolean);

    const top = /^common\/locales\/([^/]+)\.json$/;
    return paths.flatMap((path) => {
        const match = path.match(top);
        if (match === null) return [];
        const code = match[1];
        const baseJson = fileAt(root, mergeBase, path);
        const headJson = fileAt(root, head, path);
        if (headJson === undefined) return [{ code, contentChanged: false, deleted: true }];
        if (baseJson === undefined) return [{ code, contentChanged: true, deleted: false }];
        return [
            {
                code,
                contentChanged: canonicalJson(JSON.parse(baseJson)) !== canonicalJson(JSON.parse(headJson)),
                deleted: false,
            },
        ];
    });
}

// Empty array means the deploy range is compliant; each entry doubles as the failure message.
export function checkLocVersions(root: string, base: string, head: string): string[] {
    const mergeBase = mergeBaseOf(root, base, head);
    const headVersions = versionsOf(projectAt(root, head));
    const baseVersions = versionsOf(projectAt(root, mergeBase));
    return changedLocales(root, base, head)
        .filter(({ contentChanged, deleted }) => contentChanged && !deleted)
        .flatMap(({ code }) => {
            const headVersion = headVersions.get(code);
            if (headVersion === undefined) {
                return [`${code} loc strings changed but ${code} is not configured in project.json`];
            }
            const baseVersion = baseVersions.get(code);
            // Newly configured languages have no deployed baseline to stay above.
            if (baseVersion !== undefined && headVersion <= baseVersion) {
                return [
                    `${code} loc strings changed but the ${code} version did not increment (still ${headVersion}); run pnpm bump:loc on main and merge it into this branch`,
                ];
            }
            return [];
        });
}

type BumpedLoc = { code: string; from: number; to: number };

// Named codes are unconditionally bumped; empty codes derive targets from string changes
// against base. Reads and writes the working tree only, so the caller commits the result.
export function bumpLocVersions(root: string, base: string | undefined, codes: string[]): BumpedLoc[] {
    const project = JSON.parse(readFileSync(join(root, 'project.json'), 'utf8'));
    const versionByCode = new Map(
        project.languages.map(({ code, version }: { code: string; version: number }) => [code, version])
    );

    if (base === undefined && codes.length === 0) {
        throw new Error('bumpLocVersions requires a base revision when no codes are named');
    }
    const targets = (
        codes.length > 0
            ? codes
            : changedLocales(root, base!, 'HEAD')
                  .filter(({ contentChanged, deleted }) => contentChanged && !deleted)
                  .map(({ code }) => code)
    ).filter((code, index, all) => all.indexOf(code) === index);
    for (const code of targets) {
        const version = versionByCode.get(code);
        if (version === undefined) {
            throw new Error(
                `${code} is not configured in project.json; run pnpm sync:project and check for language set changes`
            );
        }
        if (!Number.isInteger(version)) {
            throw new Error(`${code} has a non-integer loc version ${version} in project.json`);
        }
        versionByCode.set(code, version + 1);
    }
    if (targets.length > 0) {
        project.languages = project.languages.map((entry: { code: string; version: number }) => ({
            ...entry,
            version: versionByCode.get(entry.code)!,
        }));
        writeFileSync(join(root, 'project.json'), `${JSON.stringify(project, null, 4)}\n`);
    }

    const original = base === undefined ? undefined : versionsOf(projectAt(root, mergeBaseOf(root, base, 'HEAD')));
    return targets.map((code) => ({
        code,
        from: original?.get(code) ?? versionByCode.get(code)! - 1,
        to: versionByCode.get(code)!,
    }));
}

export function main(argv: string[], env: NodeJS.ProcessEnv, root: string): number {
    const args = parseArgs(argv);
    const baseEnv = env.LOC_VERSIONS_BASE_SHA;
    const headEnv = env.LOC_VERSIONS_HEAD_SHA;
    if ((baseEnv !== undefined) !== (headEnv !== undefined)) {
        throw new Error('LOC_VERSIONS_BASE_SHA and LOC_VERSIONS_HEAD_SHA must be set together');
    }
    const base = args.base ?? baseEnv ?? 'origin/cf-pages';
    const head = args.head ?? headEnv ?? 'HEAD';

    if (args.check) {
        const violations = checkLocVersions(root, resolveRevision(root, base), resolveRevision(root, head));
        if (violations.length > 0) {
            console.error('Loc version check failed:');
            for (const violation of violations) console.error(`- ${violation}`);
            return 1;
        }
        console.log('Loc versions are incremented for every locale changed in this deploy range.');
        return 0;
    }

    // Stale main would compute the deploy range wrongly; only relevant when deriving targets.
    if (args.codes.length === 0 && args.base === undefined && baseEnv === undefined) {
        try {
            git(root, 'merge-base', '--is-ancestor', 'origin/main', 'HEAD');
        } catch {
            throw new Error(
                'bump:loc computes the deploy range from HEAD; run this on main containing origin/main (git fetch && git merge origin/main)'
            );
        }
    }

    const bumps = bumpLocVersions(root, args.codes.length > 0 ? undefined : resolveRevision(root, base), args.codes);
    if (bumps.length === 0) {
        console.log(`No loc string changes since ${base.slice(0, 12)}; nothing to bump.`);
        return 0;
    }
    syncProjectConfig(root);
    for (const { code, from, to } of bumps) console.log(`Bumped ${code} loc version: ${from} → ${to}`);
    console.log('Regenerated common/extension.json; commit project.json and common/extension.json together.');
    return 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        process.exitCode = main(process.argv.slice(2), process.env, fileURLToPath(new URL('../', import.meta.url)));
    } catch (error) {
        console.error(String((error as Error).message ?? error));
        process.exitCode = 1;
    }
}
