import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { isDeepStrictEqual, promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { fileInfo, packageRoot, readJson } from './lib.mjs';
import { verifyRuntimeArchive as verifyRuntimeArchiveContents } from './runtime-archive-validator.cjs';
import { extractSourcesArchive } from './sources-archive.mjs';
import { releaseNames, runtimeVersion as version } from './release-names.mjs';
import { verifyRuntimeDirectory, verifyRuntimeManifest } from './runtime-manifest.mjs';
import { parseRuntimeVersion } from './runtime-version.mjs';

const execFileAsync = promisify(execFile);

const githubHeaders = async () => {
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

const findRelease = async (apiBaseUrl, tag, headers) => {
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
    throw new Error(
        `GitHub release ${tag} was not found. For drafts, set GH_TOKEN or GITHUB_TOKEN, or run gh auth login with access to the repository.`
    );
};

const fetchAsset = async (apiBaseUrl, assets, filename, destination, headers) => {
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

const verifyPublishedRuntimeArchive = async (archivePath, extractionRoot, version) => {
    await verifyRuntimeArchiveContents(archivePath, version);
    await mkdir(extractionRoot, { recursive: true });
    await execFileAsync('tar', ['-xzf', archivePath, '-C', extractionRoot]);

    const runtimeRoot = resolve(extractionRoot, version);
    const manifest = await readJson(resolve(runtimeRoot, 'manifest.json'));
    verifyRuntimeManifest(manifest, version);
    await verifyRuntimeDirectory(runtimeRoot, manifest);
    return manifest;
};

const selectRuntime = async () => {
    parseRuntimeVersion(version);

    const repoOption = process.argv.indexOf('--repo');
    let repository =
        repoOption === -1 ? process.env.GH_REPO || process.env.GITHUB_REPOSITORY : process.argv[repoOption + 1];
    if (!repository) {
        const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd: packageRoot });
        repository = stdout.trim().match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1];
    }
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '')) {
        throw new Error('Pass a GitHub owner/repo with --repo or GH_REPO.');
    }
    const names = releaseNames(version);
    const runtimeFilename = names.runtimeArchive;
    const releaseUrl = `https://github.com/${repository}/releases/tag/${names.tag}`;
    const releaseBaseDownloadUrl = `https://github.com/${repository}/releases/download/${names.tag}`;
    const apiBaseUrl = `https://api.github.com/repos/${repository}/releases`;
    const headers = await githubHeaders();
    const release = await findRelease(apiBaseUrl, names.tag, headers);
    if (release.tag_name !== names.tag || !Array.isArray(release.assets)) {
        throw new Error('GitHub release has an invalid tag or asset inventory');
    }
    const temporaryRoot = await mkdtemp(resolve(tmpdir(), 'asbplayer-ffmpeg-release-'));

    try {
        const runtimeArchive = resolve(temporaryRoot, runtimeFilename);
        const runtimeArchiveInfo = await fetchAsset(
            apiBaseUrl,
            release.assets,
            runtimeFilename,
            runtimeArchive,
            headers
        );
        const manifest = await verifyPublishedRuntimeArchive(
            runtimeArchive,
            resolve(temporaryRoot, 'extracted'),
            version
        );
        // The release must also publish the exact upstream tarballs the runtime was built from.
        const sourcesFilename = names.sourcesArchive;
        const sourcesArchive = resolve(temporaryRoot, sourcesFilename);
        await fetchAsset(apiBaseUrl, release.assets, sourcesFilename, sourcesArchive, headers);
        await extractSourcesArchive(sourcesArchive, version, manifest.sources, resolve(temporaryRoot, 'sources'));

        const lock = {
            schemaVersion: 1,
            runtimeVersion: version,
            ffmpegVersion: manifest.ffmpeg.version,
            releaseUrl,
            releaseBaseDownloadUrl,
            runtimeArchive: runtimeArchiveInfo,
        };

        const lockPath = resolve(packageRoot, 'artifact-lock.json');
        const previous = await readJson(lockPath);
        if (previous.runtimeVersion === version && !isDeepStrictEqual(previous, lock)) {
            throw new Error(
                'Published FFmpeg ' + version + ' bytes are immutable; bump the runtime version before recording'
            );
        }

        const lockTemporary = resolve(packageRoot, `.artifact-lock-${process.pid}.tmp`);
        try {
            await writeFile(lockTemporary, JSON.stringify(lock, null, 4) + '\n');
            await rename(lockTemporary, lockPath);
        } finally {
            await rm(lockTemporary, { force: true });
        }
        process.stdout.write(
            'Selected FFmpeg runtime ' + version + '; inspect and commit artifact-lock.json explicitly.\n'
        );
        if (release.draft) {
            process.stdout.write('Publish the selected draft before the app can download this runtime.\n');
        }
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
};

await selectRuntime();
