import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

/** Upstream libraries built into the runtime. Releases publish each unmodified source tarball. */
export const upstreamSources = (config) =>
    Object.entries(config)
        .filter(([, value]) => typeof value?.source?.url === 'string')
        .map(([name, value]) => ({ name, url: value.source.url, sha256: value.source.sha256 }));

export const upstreamSourceArchive = (sourceUrl) =>
    resolve(packageRoot, '.cache/archives', basename(new URL(sourceUrl).pathname));

export const sha256 = async (path) => {
    const hash = createHash('sha256');
    await pipeline(createReadStream(path), hash);
    return hash.digest('hex');
};

export const verifyFile = async (path, expectedHash) => {
    const actualHash = await sha256(path);
    if (!expectedHash || actualHash !== expectedHash) {
        throw new Error(`SHA-256 mismatch for ${path}: expected ${expectedHash || '<missing>'}, got ${actualHash}`);
    }
};

export const download = async (url, destination, expectedHash) => {
    await mkdir(dirname(destination), { recursive: true });
    try {
        await verifyFile(destination, expectedHash);
        return;
    } catch {
        // Missing and invalid cache entries are replaced atomically below.
    }

    const temporaryRoot = await mkdtemp(`${destination}.part-`);
    const temporary = resolve(temporaryRoot, 'download');
    try {
        const response = await fetch(url, { redirect: 'follow' });
        if (!response.ok || response.body === null) {
            throw new Error(`Could not download ${url}: HTTP ${response.status}`);
        }
        await pipeline(response.body, createWriteStream(temporary, { flags: 'wx' }));
        await verifyFile(temporary, expectedHash);
        await rename(temporary, destination);
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
};

export const fileInfo = async (path) => ({
    filename: basename(path),
    bytes: (await stat(path)).size,
    sha256: await sha256(path),
});

export const runtimeFiles = async (root) => {
    const files = [];
    const visit = async (directory) => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const path = resolve(directory, entry.name);
            if (entry.isDirectory()) await visit(path);
            else if (entry.name !== 'manifest.json') files.push(relative(root, path));
        }
    };
    await visit(root);
    return files.sort();
};

/** Serialize runtime extraction across processes; downloads themselves use unique temporary files. */
export const withFileLock = async (path, action) => {
    await mkdir(dirname(path), { recursive: true });
    const deadline = Date.now() + 60_000;
    let handle;
    while (!handle) {
        try {
            handle = await open(path, 'wx');
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
            if (Date.now() >= deadline) {
                throw new Error(`Timed out waiting for ${path}. Remove it if no preparation process is running.`);
            }
            await delay(100);
        }
    }
    try {
        return await action();
    } finally {
        await handle.close();
        await rm(path, { force: true });
    }
};
