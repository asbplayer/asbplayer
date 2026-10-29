import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { packageRoot } from './lib.mjs';
import { findRelease, githubHeaders } from './github-release.mjs';

const exec = promisify(execFile);
const repository = process.env.GH_REPO || process.env.GITHUB_REPOSITORY;
const tag = process.env.RELEASE_TAG;
const target = process.env.GITHUB_SHA;
const bump = process.env.FFMPEG_VERSION_BUMP;
if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '') ||
    !/^[A-Za-z0-9_.-]+$/.test(tag ?? '') ||
    !/^[a-f0-9]{40}$/.test(target ?? '') ||
    !['patch', 'minor', 'current'].includes(bump)
) {
    throw new Error('Invalid FFmpeg release repository, tag, target, or bump');
}
const apiBaseUrl = `https://api.github.com/repos/${repository}/releases`;
const headers = await githubHeaders();
const release = await findRelease(apiBaseUrl, tag, headers, { allowMissing: true });
const requireDraft = async () => {
    const expectedId = Number(process.env.RELEASE_ID);
    if (!Number.isSafeInteger(expectedId) || expectedId <= 0) throw new Error('current requires a draft release ID');
    const response = await fetch(`${apiBaseUrl}/${expectedId}`, { headers });
    if (!response.ok) throw new Error(`Could not recheck FFmpeg draft: HTTP ${response.status}`);
    const latest = await response.json();
    if (latest.id !== expectedId || latest.tag_name !== tag || latest.draft !== true) {
        throw new Error('current (draft only) cannot update a published, missing, or replaced release');
    }
};
if (bump === 'current') {
    if (!release || release.id !== Number(process.env.RELEASE_ID) || release.draft !== true) {
        throw new Error('current (draft only) requires the original draft to still exist and be unpublished');
    }
} else if (release) {
    throw new Error(`FFmpeg release ${tag} already exists; use current to rebuild a draft`);
}

// A pre-existing tag would keep pointing at old sources even if target_commitish were updated.
const tagUrl = `https://api.github.com/repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`;
const tagResponse = await fetch(tagUrl, { headers });
if (tagResponse.ok) throw new Error(`FFmpeg tag ${tag} already exists; refusing to change its source`);
if (tagResponse.status !== 404) throw new Error(`Could not check FFmpeg tag: HTTP ${tagResponse.status}`);

const directory = resolve(packageRoot, 'release');
const files = (await readdir(directory))
    .filter((name) => name.endsWith('.tar.gz'))
    .sort()
    .map((name) => resolve(directory, name));
if (files.length !== 2) throw new Error('Expected exactly the FFmpeg runtime and sources archives');
if (bump === 'current') {
    await requireDraft();
    await exec('gh', ['release', 'upload', tag, ...files, '--repo', repository, '--clobber']);
    await requireDraft();
    await exec('gh', ['release', 'edit', tag, '--repo', repository, '--target', target]);
    process.stdout.write(`Updated FFmpeg draft ${tag} and its source commit\n`);
} else {
    await exec('gh', [
        'release',
        'create',
        tag,
        ...files,
        '--repo',
        repository,
        '--draft',
        '--target',
        target,
        '--title',
        process.env.RELEASE_TITLE,
        '--notes',
        'Minimal single-threaded LGPL FFmpeg runtime. The runtime archive includes license notices. The sources archive holds the unmodified upstream source tarballs; the asbplayer bridge and build scripts are in the source code archives for this tag.',
        '--latest=false',
    ]);
    process.stdout.write(`Created FFmpeg draft ${tag}\n`);
}
