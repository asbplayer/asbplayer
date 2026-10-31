import { execFile } from 'node:child_process';
import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import {
    packageRoot,
    readJson,
    upstreamSourceArchive,
    upstreamSources,
    upstreamTarballName,
    verifyFile,
} from './lib.mjs';
import { releaseNames, runtimeVersion as version } from './release-names.mjs';

const execFileAsync = promisify(execFile);
const names = releaseNames(version);
const config = await readJson(resolve(packageRoot, 'build-config.json'));
const release = resolve(packageRoot, 'release');
const packageArchive = (archive, directory, entry) =>
    execFileAsync('bash', [resolve(packageRoot, 'scripts/package-archive.sh'), archive, directory, entry]);

// The workflow publishes every file in this directory; keep only this candidate's assets.
await rm(release, { recursive: true, force: true });
await mkdir(release, { recursive: true });
const runtimeStaging = resolve(packageRoot, '.cache/release-runtime');
await rm(runtimeStaging, { recursive: true, force: true });
try {
    await cp(resolve(packageRoot, 'dist', version), resolve(runtimeStaging, names.runtimeRoot), {
        recursive: true,
    });
    await packageArchive(resolve(release, names.runtimeArchive), runtimeStaging, names.runtimeRoot);
} finally {
    await rm(runtimeStaging, { recursive: true, force: true });
}

// Publish the exact upstream tarballs used by the build, unmodified, as the libraries' corresponding source.
const staging = resolve(packageRoot, '.cache/release-sources');
const sourcesRoot = resolve(staging, names.sourcesRoot);
await rm(staging, { recursive: true, force: true });
await mkdir(sourcesRoot, { recursive: true });
try {
    for (const { url, sha256 } of upstreamSources(config)) {
        const upstream = upstreamSourceArchive(url);
        await verifyFile(upstream, sha256);
        await copyFile(upstream, resolve(sourcesRoot, upstreamTarballName(url)));
    }
    await packageArchive(resolve(release, names.sourcesArchive), staging, names.sourcesRoot);
} finally {
    await rm(staging, { recursive: true, force: true });
}
process.stdout.write('Candidate release materials generated; artifact-lock.json was not modified.\n');
