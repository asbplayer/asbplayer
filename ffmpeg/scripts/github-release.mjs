import { createWriteStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { fileInfo } from './lib.mjs';

const execFileAsync = promisify(execFile);

export const githubHeaders = async () => {
    let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) {
        try {
            const { stdout } = await execFileAsync('gh', ['auth', 'token', '--hostname', 'github.com']);
            token = stdout.trim();
        } catch {
            // Public releases can be selected without credentials or the GitHub CLI.
        }
    }
    return {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

export const findRelease = async (apiBaseUrl, tag, headers, { allowMissing = false } = {}) => {
    const url = `${apiBaseUrl}/tags/${encodeURIComponent(tag)}`;
    const response = await fetch(url, { headers });
    if (response.ok) return response.json();
    if (response.status !== 404) throw new Error(`Could not read ${url}: HTTP ${response.status}`);

    // The tag endpoint only returns published releases; authenticated listings also include drafts.
    for (let page = 1; ; page++) {
        const listUrl = `${apiBaseUrl}?per_page=100&page=${page}`;
        const listResponse = await fetch(listUrl, { headers });
        if (!listResponse.ok) throw new Error(`Could not read ${listUrl}: HTTP ${listResponse.status}`);
        const releases = await listResponse.json();
        const release = releases.find((release) => release.tag_name === tag);
        if (release) return release;
        if (releases.length < 100) break;
    }
    if (allowMissing) return;
    throw new Error(
        `GitHub release ${tag} was not found. For drafts, set GH_TOKEN or GITHUB_TOKEN, or run gh auth login with access to the repository.`
    );
};

export const listReleases = async (apiBaseUrl, headers) => {
    const releases = [];
    for (let page = 1; ; page++) {
        const url = `${apiBaseUrl}?per_page=100&page=${page}`;
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Could not read ${url}: HTTP ${response.status}`);
        const batch = await response.json();
        releases.push(...batch);
        if (batch.length < 100) return releases;
    }
};

export const fetchAsset = async (apiBaseUrl, assets, filename, destination, headers, expected) => {
    const asset = assets.find((asset) => asset.name === filename);
    if (!asset) throw new Error(`GitHub release is missing ${filename}`);
    if (
        !Number.isSafeInteger(asset.id) ||
        asset.id <= 0 ||
        !Number.isSafeInteger(asset.size) ||
        asset.size < 0 ||
        !/^sha256:[a-f0-9]{64}$/.test(asset.digest ?? '')
    ) {
        throw new Error(`GitHub asset ${filename} has no valid SHA-256 digest, size, or identity`);
    }
    if (expected && (`sha256:${expected.sha256}` !== asset.digest || expected.bytes !== asset.size)) {
        throw new Error(`GitHub asset ${filename} differs from artifact-lock.json; reselect the draft`);
    }
    const url = `${apiBaseUrl}/assets/${asset.id}`;
    const response = await fetch(url, {
        redirect: 'follow',
        headers: { ...headers, Accept: 'application/octet-stream' },
    });
    if (!response.ok || response.body === null) throw new Error(`Could not download ${url}: HTTP ${response.status}`);
    await pipeline(response.body, createWriteStream(destination, { flags: 'wx' }));
    const info = await fileInfo(destination);
    if (`sha256:${info.sha256}` !== asset.digest || info.bytes !== asset.size) {
        throw new Error(`GitHub SHA-256 or size mismatch for ${filename}`);
    }
    return info;
};
