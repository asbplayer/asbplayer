const { execFileSync } = require('node:child_process');

const contributorStartMarker = '<!-- BEGIN CONTRIBUTORS -->';
const contributorEndMarker = '<!-- END CONTRIBUTORS -->';

function git(...args: string[]): string {
    return execFileSync('git', args, { encoding: 'utf8' });
}

function getCommitRange(): { range: string; baseSha?: string; headSha: string } {
    const baseSha = process.env.CONTRIBUTORS_BASE_SHA?.trim();
    const headSha = process.env.CONTRIBUTORS_HEAD_SHA?.trim();
    if (baseSha && headSha) return { range: `${baseSha}..${headSha}`, baseSha, headSha };
    if (baseSha || headSha) throw new Error('CONTRIBUTORS_BASE_SHA and CONTRIBUTORS_HEAD_SHA must be set together');

    const eventBefore = process.env.GITHUB_EVENT_BEFORE?.trim();
    const eventSha = process.env.GITHUB_SHA?.trim();
    if (eventBefore && eventSha && !/^0+$/.test(eventBefore)) {
        return { range: `${eventBefore}..${eventSha}`, baseSha: eventBefore, headSha: eventSha };
    }

    if (process.env.GITHUB_ACTIONS === 'true') {
        throw new Error('Unable to determine contributor commit range in GitHub Actions');
    }

    return { range: 'HEAD^..HEAD', baseSha: 'HEAD^', headSha: 'HEAD' };
}

function getContributorSection(lines: string[]): { start: number; end: number } {
    const start = lines.indexOf(contributorStartMarker);
    const end = lines.indexOf(contributorEndMarker);
    if (
        start < 0 ||
        end < 0 ||
        start >= end ||
        start !== lines.lastIndexOf(contributorStartMarker) ||
        end !== lines.lastIndexOf(contributorEndMarker)
    ) {
        throw new Error(
            `CONTRIBUTORS must contain exactly one ${contributorStartMarker} before exactly one ${contributorEndMarker}`
        );
    }
    return { start, end };
}

function getContributorSectionLines(content: string): { lines: string[]; start: number; end: number } {
    if (content.includes('\r')) {
        throw new Error('CONTRIBUTORS must use LF line endings');
    }

    const lines = content.split('\n');
    const { start, end } = getContributorSection(lines);
    return { lines, start, end };
}

function readContributorLines(content: string): string[] {
    const { lines, start, end } = getContributorSectionLines(content);
    return lines.slice(start + 1, end);
}

function getContributorContentAtRevision(revision: string): string | undefined {
    if (!fileExistsAtRevision(revision, 'CONTRIBUTORS')) return undefined;
    return git('show', `${revision}:CONTRIBUTORS`);
}

function getContributorLinesAtRevision(revision: string): string[] | undefined {
    const content = getContributorContentAtRevision(revision);
    return content === undefined ? undefined : readContributorLines(content);
}

function verifyContributorSectionIsAppendOnly(
    previousLines: string[] | undefined,
    currentLines: string[] | undefined
): void {
    if (previousLines === undefined) return;
    if (currentLines === undefined) throw new Error('CONTRIBUTORS may not be removed');
    if (currentLines.length < previousLines.length) {
        throw new Error('Existing CONTRIBUTORS entries may not be removed');
    }

    for (let i = 0; i < previousLines.length; ++i) {
        if (currentLines[i] !== previousLines[i]) {
            throw new Error('Existing CONTRIBUTORS entries may not be modified or reordered');
        }
    }
}

function verifyContributorHistoryIsAppendOnly(baseSha: string, headSha: string, range: string): void {
    const baseLines = getContributorLinesAtRevision(baseSha);
    const commits = git('rev-list', range)
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);

    if (!commits.length) {
        verifyContributorSectionIsAppendOnly(baseLines, getContributorLinesAtRevision(headSha));
        return;
    }

    for (const commit of commits) {
        const currentLines = getContributorLinesAtRevision(commit);
        const parents = git('rev-list', '--parents', '-n', '1', commit).trim().split(/\s+/).slice(1);

        if (!parents.length) {
            verifyContributorSectionIsAppendOnly(undefined, currentLines);
            continue;
        }

        for (const parent of parents) {
            verifyContributorSectionIsAppendOnly(getContributorLinesAtRevision(parent), currentLines);
        }
    }
}

function fileExistsAtRevision(revision: string, path: string): boolean {
    return git('ls-tree', '--name-only', revision, '--', path).trim() === path;
}

function getBlamedLines(
    revision: string,
    start: number,
    end: number
): Array<{ commit: string; content: string }> {
    const firstLine = start + 2;
    const lastLine = end;
    if (firstLine > lastLine) return [];

    const blame = git('blame', '--line-porcelain', '-L', `${firstLine},${lastLine}`, revision, '--', 'CONTRIBUTORS');
    const blamedLines: Array<{ commit: string; content: string }> = [];
    let commit: string | undefined;

    for (const line of blame.split('\n')) {
        const commitHeader = line.match(/^([0-9a-f]+) \d+ \d+(?: \d+)?$/);
        if (commitHeader) {
            commit = commitHeader[1];
            continue;
        }

        if (line.startsWith('\t') && commit) {
            blamedLines.push({ commit, content: line.slice(1) });
            commit = undefined;
        }
    }

    return blamedLines;
}

const authorEmails = new Map<string, string>();

function getAuthorEmail(commit: string): string {
    let email = authorEmails.get(commit);
    if (email === undefined) {
        const output = git('show', '-s', '--format=%ae%x00', commit);
        if (!output.endsWith('\0\n') && !output.endsWith('\0')) {
            throw new Error(`Unexpected git output for ${commit}`);
        }
        email = output.replace(/\0\n?$/, '');
        authorEmails.set(commit, email);
    }
    return email;
}

function isContributorEntry(line: string): boolean {
    const content = line.trim();
    return content.length > 0 && !content.startsWith('#') && !content.startsWith('<!--');
}

function getContributorEmails(revision: string): Set<string> {
    const content = getContributorContentAtRevision(revision);
    if (content === undefined) throw new Error(`CONTRIBUTORS does not exist at ${revision}`);
    const { lines, start, end } = getContributorSectionLines(content);
    return new Set(
        getBlamedLines(revision, start, end)
            .filter(({ content }) => isContributorEntry(content))
            .map(({ commit }) => getAuthorEmail(commit))
            .filter(Boolean)
    );
}

function getBypassedEmails(): Set<string> {
    return new Set(
        (process.env.CONTRIBUTORS_BYPASS ?? '')
            .split(',')
            .filter(Boolean)
    );
}

function getCommits(range: string): Array<{ hash: string; email: string; subject: string }> {
    const output = git('log', '-z', '--format=%H%x00%ae%x00%s', range);
    if (!output) return [];

    const fields = output.split('\0');
    if (fields.at(-1) === '') fields.pop();

    if (fields.length % 3 !== 0) throw new Error('Unexpected git log output');

    const commits: Array<{ hash: string; email: string; subject: string }> = [];
    for (let i = 0; i < fields.length; i += 3) {
        commits.push({
            hash: fields[i],
            email: fields[i + 1],
            subject: fields[i + 2],
        });
    }

    return commits;
}

function checkContributors(): void {
    const { range, baseSha, headSha } = getCommitRange();
    if (baseSha) verifyContributorHistoryIsAppendOnly(baseSha, headSha, range);

    const registeredEmails = getContributorEmails(headSha);
    const bypassedEmails = getBypassedEmails();
    const missing = getCommits(range).filter(({ email }) => !registeredEmails.has(email) && !bypassedEmails.has(email));
    if (!missing.length) return;

    console.error('Contributor check failed. The following commit authors are not registered:');
    for (const { hash, email, subject } of missing) console.error(`- ${email} (${hash.slice(0, 7)}) ${subject}`);
    console.error('Add your name to CONTRIBUTORS in a commit authored with the same email.');
    process.exitCode = 1;
}

checkContributors();
