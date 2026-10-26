import { mkdir, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { download, packageRoot, readJson, upstreamSourceArchive, upstreamSources } from './lib.mjs';

const execFileAsync = promisify(execFile);
const config = await readJson(resolve(packageRoot, 'build-config.json'));
for (const { name, url, sha256 } of upstreamSources(config)) {
    const destination = resolve(packageRoot, '.cache/sources', name);
    const archive = upstreamSourceArchive(url);
    await download(url, archive, sha256);
    const staged = `${destination}.staged`;
    await rm(staged, { recursive: true, force: true });
    await mkdir(staged, { recursive: true });
    await execFileAsync('tar', ['-xf', archive, '--strip-components=1', '-C', staged]);
    await rm(destination, { recursive: true, force: true });
    await rename(staged, destination);
}
