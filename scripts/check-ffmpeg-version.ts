import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

function parseVersion(version: unknown): [bigint, bigint] {
    const match = typeof version === 'string' && /^0\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
    if (!match || match[0] !== version) {
        throw new Error(
            `FFmpeg runtime version must be 0.X.Y with no leading zeros or suffixes; received ${JSON.stringify(version)}`
        );
    }
    return [BigInt(match[1]), BigInt(match[2])];
}

/** Validate the working tree (or an explicit head), optionally against a Git merge base. */
export function checkFfmpegVersion(root: string, baseRef?: string, headRef?: string): void {
    if ((baseRef !== undefined && !baseRef.trim()) || (headRef !== undefined && !headRef.trim())) {
        throw new Error('Version comparison requires nonempty Git references');
    }
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
    const project = JSON.parse(
        headRef === undefined
            ? readFileSync(join(root, 'project.json'), 'utf8')
            : git('show', `${headRef}:project.json`)
    );
    const version = project.artifacts?.ffmpeg?.version;
    const [x, y] = parseVersion(version);
    if (baseRef === undefined) return;
    const mergeBase = git('merge-base', baseRef, headRef ?? 'HEAD');
    if (!git('ls-tree', '--name-only', mergeBase, '--', 'project.json')) return;
    const previous = JSON.parse(git('show', `${mergeBase}:project.json`)).artifacts?.ffmpeg?.version;
    // The first introduction of the runtime version has no previous value to compare.
    if (previous === undefined) return;
    const [previousX, previousY] = parseVersion(previous);
    if (version === previous || (x === previousX && y === previousY + 1n) || (x === previousX + 1n && y === 0n)) {
        return;
    }
    throw new Error(
        `FFmpeg runtime version ${previous} -> ${version} is invalid. ` +
            `Keep ${previous}, increment Y by 1 (0.${previousX}.${previousY + 1n}), ` +
            `or increment X by 1 and reset Y to zero (0.${previousX + 1n}.0).`
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const { values } = parseArgs({ options: { base: { type: 'string' }, head: { type: 'string' } } });
        if (values.head !== undefined && values.base === undefined) throw new Error('--head requires --base');
        checkFfmpegVersion(fileURLToPath(new URL('../', import.meta.url)), values.base, values.head);
    } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    }
}
