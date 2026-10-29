import { mkdtemp, rename, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { download, packageRoot } from './lib.mjs';
import { fetchAsset, findRelease, githubHeaders } from './github-release.mjs';

/** Acquire the selected release for app hosting, without a native toolchain or source downloads. */
export const prepareRuntime = async (lock, cacheDirectory = resolve(packageRoot, '.cache/runtimes')) => {
    const { sha256, bytes } = lock.runtimeArchive;
    if (!/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(bytes) || bytes <= 0) {
        throw new Error('Invalid FFmpeg runtime hash or size in artifact-lock.json');
    }
    const archivePath = resolve(cacheDirectory, `${sha256}.tgz`);
    try {
        await download(`${lock.releaseBaseDownloadUrl}/${lock.runtimeArchive.filename}`, archivePath, sha256);
    } catch (error) {
        // Public builds stay anonymous. Local draft testing can use an existing gh login or token.
        const release =
            /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/releases\/download\/([^/?#]+)$/.exec(
                lock.releaseBaseDownloadUrl
            );
        if (error.status !== 404 || !release) throw error;
        const headers = await githubHeaders();
        if (!headers.Authorization) throw error;
        const apiBaseUrl = `https://api.github.com/repos/${release[1]}/releases`;
        const tag = decodeURIComponent(release[2]);
        const selected = await findRelease(apiBaseUrl, tag, headers);
        if (selected.tag_name !== tag || !Array.isArray(selected.assets)) {
            throw new Error('GitHub release has an invalid tag or asset inventory');
        }
        const temporaryRoot = await mkdtemp(`${archivePath}.part-`);
        try {
            const temporary = resolve(temporaryRoot, 'runtime.tgz');
            await fetchAsset(
                apiBaseUrl,
                selected.assets,
                lock.runtimeArchive.filename,
                temporary,
                headers,
                lock.runtimeArchive
            );
            await rename(temporary, archivePath);
        } finally {
            await rm(temporaryRoot, { recursive: true, force: true });
        }
    }
    if ((await stat(archivePath)).size !== bytes) {
        throw new Error('FFmpeg runtime size differs from artifact-lock.json');
    }
    return archivePath;
};
