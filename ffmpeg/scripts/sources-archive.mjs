import { execFile } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { promisify } from 'node:util';
import { sha256 } from './lib.mjs';
import { releaseNames } from './release-names.mjs';
import { verifySourcesArchive } from './runtime-archive-validator.cjs';

const execFileAsync = promisify(execFile);

export const upstreamTarballName = (url) => basename(new URL(url).pathname);

/** Extract a sources archive and check that it holds exactly the expected upstream tarballs. */
export const extractSourcesArchive = async (archivePath, version, sources, destination) => {
    const { sourcesRoot } = releaseNames(version);
    await verifySourcesArchive(archivePath, sourcesRoot);
    await mkdir(destination, { recursive: true });
    await execFileAsync('tar', ['-xzf', archivePath, '-C', destination]);
    const root = resolve(destination, sourcesRoot);
    const expected = sources.map(({ url }) => upstreamTarballName(url)).sort();
    if (JSON.stringify((await readdir(root)).sort()) !== JSON.stringify(expected)) {
        throw new Error('Sources archive does not contain exactly the upstream source tarballs');
    }
    for (const { name, url, sha256: expectedHash } of sources) {
        if ((await sha256(resolve(root, upstreamTarballName(url)))) !== expectedHash) {
            throw new Error(`Published ${name} source differs from the source recorded by the runtime manifest`);
        }
    }
    return root;
};
