import { createWriteStream } from 'node:fs';
import { lstat, mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { isDeepStrictEqual, promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { packageRoot, readJson, runtimeFiles, sha256 } from './lib.mjs';
import { verifyRuntimeArchive as verifyRuntimeArchiveContents } from './runtime-archive-validator.cjs';
import { extractSourcesArchive } from './sources-archive.mjs';
import { releaseNames, runtimeVersion as version } from './release-names.mjs';

const execFileAsync = promisify(execFile);

const fetchAsset = async (baseUrl, filename, destination) => {
    const url = `${baseUrl}/${filename}`;
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok || response.body === null) throw new Error(`Could not download ${url}: HTTP ${response.status}`);
    await pipeline(response.body, createWriteStream(destination, { flags: 'wx' }));
};

const verifyPublishedRuntimeArchive = async (archivePath, extractionRoot, version) => {
    await verifyRuntimeArchiveContents(archivePath, version);
    await mkdir(extractionRoot, { recursive: true });
    await execFileAsync('tar', ['-xzf', archivePath, '-C', extractionRoot]);

    const runtimeRoot = resolve(extractionRoot, version);
    const rootStat = await lstat(runtimeRoot);
    if (!rootStat.isDirectory()) throw new Error('Published runtime archive has no version directory');
    const manifest = await readJson(resolve(runtimeRoot, 'manifest.json'));
    if (
        manifest.schemaVersion !== 1 ||
        manifest.runtimeVersion !== version ||
        typeof manifest.ffmpeg?.version !== 'string' ||
        typeof manifest.ffmpeg.configuration !== 'string' ||
        !Array.isArray(manifest.sources) ||
        manifest.sources.length === 0 ||
        manifest.sources.some(
            (source) =>
                typeof source?.name !== 'string' ||
                typeof source.url !== 'string' ||
                !/^[a-f0-9]{64}$/.test(source.sha256 ?? '')
        ) ||
        !Array.isArray(manifest.runtime)
    ) {
        throw new Error('Published runtime manifest has an invalid identity or inventory');
    }
    if (manifest.ffmpeg.configuration.split(' ').some((argument) => argument.startsWith('--extra-version='))) {
        throw new Error('Published runtime overrides the upstream FFmpeg version identity');
    }

    const declaredFiles = manifest.runtime.map(({ filename }) => filename);
    if (
        declaredFiles.some(
            (filename) =>
                typeof filename !== 'string' ||
                filename === 'manifest.json' ||
                filename.startsWith('/') ||
                filename.includes('\\') ||
                filename.split('/').some((component) => component === '' || component === '..')
        ) ||
        new Set(declaredFiles).size !== declaredFiles.length
    ) {
        throw new Error('Published runtime manifest contains an unsafe or duplicate file path');
    }

    const actualFiles = await runtimeFiles(runtimeRoot);
    const expectedFiles = [...declaredFiles].sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
        throw new Error('Published runtime archive does not match its manifest inventory');
    }
    for (const entry of manifest.runtime) {
        const path = resolve(runtimeRoot, entry.filename);
        const fileStat = await lstat(path);
        if (!fileStat.isFile() || fileStat.size !== entry.bytes || (await sha256(path)) !== entry.sha256) {
            throw new Error(`Published runtime hash or size mismatch for ${entry.filename}`);
        }
    }
    return manifest;
};

const selectRuntime = async () => {
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
        throw new Error('FFmpeg runtime version is invalid: ' + version);
    }

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
    const temporaryRoot = await mkdtemp(resolve(tmpdir(), 'asbplayer-ffmpeg-release-'));

    try {
        const runtimeArchive = resolve(temporaryRoot, runtimeFilename);
        await fetchAsset(releaseBaseDownloadUrl, runtimeFilename, runtimeArchive);
        const manifest = await verifyPublishedRuntimeArchive(
            runtimeArchive,
            resolve(temporaryRoot, 'extracted'),
            version
        );
        // The release must also publish the exact upstream tarballs the runtime was built from.
        const sourcesFilename = names.sourcesArchive;
        const sourcesArchive = resolve(temporaryRoot, sourcesFilename);
        await fetchAsset(releaseBaseDownloadUrl, sourcesFilename, sourcesArchive);
        await extractSourcesArchive(sourcesArchive, version, manifest.sources, resolve(temporaryRoot, 'sources'));

        const lock = {
            schemaVersion: 1,
            runtimeVersion: version,
            ffmpegVersion: manifest.ffmpeg.version,
            releaseUrl,
            releaseBaseDownloadUrl,
            runtimeArchive: {
                filename: runtimeFilename,
                sha256: await sha256(runtimeArchive),
                bytes: (await stat(runtimeArchive)).size,
            },
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
            'Selected published FFmpeg runtime ' + version + '; inspect and commit artifact-lock.json explicitly.\n'
        );
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
};

await selectRuntime();
