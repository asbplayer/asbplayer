import { parseArgs } from 'node:util';
import artifactLock from '../artifact-lock.json' with { type: 'json' };
import { releaseNames, runtimeVersion } from './release-names.mjs';
import { parseRuntimeVersion } from './runtime-version.mjs';
import { githubHeaders, listReleases } from './github-release.mjs';

const { values, positionals } = parseArgs({ options: { bump: { type: 'string' } }, allowPositionals: true });
let version = runtimeVersion;
let releaseId;
if (values.bump !== undefined) {
    const [minor, patch] = parseRuntimeVersion(artifactLock.runtimeVersion);
    if (values.bump === 'patch') version = `0.${minor}.${patch + 1n}`;
    else if (values.bump === 'minor') version = `0.${minor + 1n}.0`;
    else if (values.bump === 'current') {
        const repository = process.env.GH_REPO || process.env.GITHUB_REPOSITORY;
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) {
            throw new Error('Set GH_REPO or GITHUB_REPOSITORY to find the current FFmpeg draft');
        }
        const releases = await listReleases(
            `https://api.github.com/repos/${repository}/releases`,
            await githubHeaders()
        );
        const drafts = releases.flatMap((release) => {
            if (release.draft !== true) return [];
            for (const candidate of release.tag_name.match(/0\.\d+\.\d+/g) ?? []) {
                try {
                    parseRuntimeVersion(candidate);
                    if (releaseNames(candidate).tag === release.tag_name) return [{ release, version: candidate }];
                } catch {
                    // Ignore drafts outside the canonical FFmpeg version/name scheme.
                }
            }
            return [];
        });
        if (drafts.length !== 1) {
            throw new Error('current (draft only) requires exactly one existing FFmpeg draft; found ' + drafts.length);
        }
        version = drafts[0].version;
        releaseId = drafts[0].release.id;
        if (!Number.isSafeInteger(releaseId) || releaseId <= 0) throw new Error('Invalid GitHub draft release ID');
    } else throw new Error('FFmpeg release bump must be patch, minor, or current');
}
if (positionals.length > 1) throw new Error('Pass at most one release field');

// Print one field for shell scripts, or all fields as GitHub Actions outputs.
const info = { version, ...releaseNames(version) };
if (releaseId !== undefined) info.releaseId = releaseId;
const field = positionals[0];
if (field !== undefined) {
    if (!Object.hasOwn(info, field)) throw new Error(`Unknown release field: ${field}`);
    process.stdout.write(`${info[field]}\n`);
} else {
    for (const [key, value] of Object.entries(info)) process.stdout.write(`${key}=${value}\n`);
}
