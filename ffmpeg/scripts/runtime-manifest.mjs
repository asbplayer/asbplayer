import { lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { runtimeFiles, sha256 } from './lib.mjs';

/** Validate the common release contract, independently of local build inputs or the selected lock. */
export const verifyRuntimeManifest = (manifest, version) => {
    if (
        manifest?.schemaVersion !== 1 ||
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
        throw new Error('FFmpeg manifest has an invalid identity or inventory');
    }
    if (manifest.ffmpeg.configuration.split(/\s+/).some((argument) => argument.startsWith('--extra-version='))) {
        throw new Error('FFmpeg configuration must not override the upstream version identity');
    }
    const filenames = manifest.runtime.map((entry) => entry?.filename);
    if (
        filenames.some(
            (filename) =>
                typeof filename !== 'string' ||
                filename === 'manifest.json' ||
                filename.startsWith('/') ||
                filename.includes('\\') ||
                filename.split('/').some((component) => component === '' || component === '.' || component === '..')
        ) ||
        new Set(filenames).size !== filenames.length
    ) {
        throw new Error('Runtime manifest contains an unsafe or duplicate file path');
    }
};

/** Check both prepared and extracted runtime directories using the same inventory and file rules. */
export const verifyRuntimeDirectory = async (root, manifest) => {
    if (!(await lstat(root)).isDirectory()) throw new Error('FFmpeg runtime has no version directory');
    const actualFiles = await runtimeFiles(root);
    const declaredFiles = manifest.runtime.map(({ filename }) => filename).sort();
    if (!isDeepStrictEqual(actualFiles, declaredFiles)) throw new Error('Runtime file inventory is incomplete');
    for (const entry of manifest.runtime) {
        const path = resolve(root, entry.filename);
        const fileStat = await lstat(path);
        if (!fileStat.isFile() || fileStat.size !== entry.bytes || (await sha256(path)) !== entry.sha256) {
            throw new Error(`Runtime hash or size mismatch for ${entry.filename}`);
        }
    }
};
