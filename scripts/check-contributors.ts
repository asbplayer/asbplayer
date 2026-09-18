const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const contributorsPath = resolve('CONTRIBUTORS');
const contributorStartMarker = '<!-- BEGIN CONTRIBUTORS -->';
const contributorEndMarker = '<!-- END CONTRIBUTORS -->';

function git(...args: string[]): string {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function normalizeEmail(email: string): string {
    const normalized = email.trim().toLowerCase();
    const githubNoreplyMatch = normalized.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/);
    return githubNoreplyMatch?.[1] ?? normalized;
}

function getCommitRange(): string {
    const baseSha = process.env.CONTRIBUTORS_BASE_SHA?.trim();
    const headSha = process.env.CONTRIBUTORS_HEAD_SHA?.trim();
    if (baseSha && headSha) return `${baseSha}..${headSha}`;
    if (baseSha || headSha) {
        throw new Error('CONTRIBUTORS_BASE_SHA and CONTRIBUTORS_HEAD_SHA must be set together');
    }

    const eventBefore = process.env.GITHUB_EVENT_BEFORE?.trim();
    const eventSha = process.env.GITHUB_SHA?.trim();
    if (eventBefore && eventSha && !/^0+$/.test(eventBefore)) {
        return `${eventBefore}..${eventSha}`;
    }

    return 'HEAD^..HEAD';
}

function getContributorSection(lines: string[]): { start: number; end: number } {
    const start = lines.indexOf(contributorStartMarker);
    const end = lines.indexOf(contributorEndMarker);
    if (start < 0 || end < 0 || start >= end) {
        throw new Error(`CONTRIBUTORS must contain ${contributorStartMarker} before ${contributorEndMarker}`);
    }
    return { start, end };
}

function getBlamedLines(start: number, end: number): Array<{ email: string; content: string }> {
    const firstLine = start + 2;
    const lastLine = end;
    if (firstLine > lastLine) return [];

    const blame = git('blame', '--line-porcelain', '-L', `${firstLine},${lastLine}`, '--', 'CONTRIBUTORS');
    const blamedLines: Array<{ email: string; content: string }> = [];
    let authorEmail: string | undefined;

    for (const line of blame.split('\n')) {
        if (/^[0-9a-f^]{40} \d+ \d+(?: \d+)?$/.test(line)) {
            authorEmail = undefined;
            continue;
        }

        const authorMail = line.match(/^author-mail <(.*)>$/);
        if (authorMail) {
            authorEmail = authorMail[1];
            continue;
        }

        if (line.startsWith('\t') && authorEmail) {
            blamedLines.push({ email: authorEmail, content: line.slice(1) });
            authorEmail = undefined;
        }
    }

    return blamedLines;
}

function isContributorEntry(line: string): boolean {
    const content = line.trim();
    return content.length > 0 && !content.startsWith('#') && !content.startsWith('<!--');
}

function getContributorEmails(): Set<string> {
    const lines = readFileSync(contributorsPath, 'utf8').split(/\r?\n/);
    const { start, end } = getContributorSection(lines);
    return new Set(
        getBlamedLines(start, end)
            .filter(({ content }) => isContributorEntry(content))
            .map(({ email }) => normalizeEmail(email))
            .filter(Boolean)
    );
}

function getBypassedEmails(): Set<string> {
    return new Set(
        (process.env.CONTRIBUTORS_BYPASS ?? '')
            .split(/[\s,]+/)
            .map(normalizeEmail)
            .filter(Boolean)
    );
}

function checkContributors(): void {
    const registeredEmails = getContributorEmails();
    const bypassedEmails = getBypassedEmails();
    const commits = git('log', '--format=%H%x09%ae%x09%s', getCommitRange());

    const missing = commits
        .split('\n')
        .filter(Boolean)
        .map((line) => {
            const [hash, email, ...subjectParts] = line.split('\t');
            return { hash, email: normalizeEmail(email), subject: subjectParts.join('\t') };
        })
        .filter(({ email }) => !registeredEmails.has(email) && !bypassedEmails.has(email));
    if (!missing.length) return;

    console.error('Contributor check failed. The following commit authors are not registered:');
    for (const { hash, email, subject } of missing) {
        console.error(`- ${email} (${hash.slice(0, 7)}) ${subject}`);
    }
    console.error('Add your name to CONTRIBUTORS in a commit authored with the same email.');
    process.exitCode = 1;
}

checkContributors();
