import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { isDeepStrictEqual, parseArgs, promisify } from 'node:util';
import { packageRoot, readJson } from './lib.mjs';
import { verifyRuntimeArchive as verifyRuntimeArchiveContents } from './runtime-archive-validator.cjs';
import { extractSourcesArchive } from './sources-archive.mjs';
import { releaseNames } from './release-names.mjs';
import { verifyRuntimeDirectory, verifyRuntimeManifest } from './runtime-manifest.mjs';
import { parseRuntimeVersion } from './runtime-version.mjs';
import { githubHeaders, findRelease, fetchAsset } from './github-release.mjs';

const execFileAsync = promisify(execFile);

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
    const { values } = parseArgs({ options: { repo: { type: 'string' }, version: { type: 'string' } } });
    const version = values.version;
    if (version === undefined) throw new Error('Pass a runtime version with --version 0.X.Y.');
    parseRuntimeVersion(version);

    let repository = values.repo ?? (process.env.GH_REPO || process.env.GITHUB_REPOSITORY);
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
        if (previous.runtimeVersion === version && !isDeepStrictEqual(previous, lock) && release.draft !== true) {
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
            process.stdout.write(
                'Draft selected for local testing. Keep the lock change uncommitted until the release is published.\n'
            );
        }
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
};

await selectRuntime();
