import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { download, packageRoot } from './lib.mjs';

/** Acquire the selected release for app hosting, without a native toolchain or source downloads. */
export const prepareRuntime = async (lock, cacheDirectory = resolve(packageRoot, '.cache/runtimes')) => {
    const { sha256, bytes } = lock.runtimeArchive;
    if (!/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(bytes) || bytes <= 0) {
        throw new Error('Invalid FFmpeg runtime hash or size in artifact-lock.json');
    }
    const archivePath = resolve(cacheDirectory, `${sha256}.tgz`);
    await download(`${lock.releaseBaseDownloadUrl}/${lock.runtimeArchive.filename}`, archivePath, sha256);
    if ((await stat(archivePath)).size !== bytes) {
        throw new Error('FFmpeg runtime size differs from artifact-lock.json');
    }
    return archivePath;
};
