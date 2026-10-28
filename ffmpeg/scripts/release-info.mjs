import { parseArgs } from 'node:util';
import artifactLock from '../artifact-lock.json' with { type: 'json' };
import { releaseNames, runtimeVersion } from './release-names.mjs';
import { parseRuntimeVersion } from './runtime-version.mjs';

const { values, positionals } = parseArgs({ options: { bump: { type: 'string' } }, allowPositionals: true });
let version = runtimeVersion;
if (values.bump !== undefined) {
    const [minor, patch] = parseRuntimeVersion(artifactLock.runtimeVersion);
    if (values.bump === 'patch') version = `0.${minor}.${patch + 1n}`;
    else if (values.bump === 'minor') version = `0.${minor + 1n}.0`;
    else throw new Error('FFmpeg release bump must be patch or minor');
}
if (positionals.length > 1) throw new Error('Pass at most one release field');

// Print one field for shell scripts, or all fields as GitHub Actions outputs.
const info = { version, ...releaseNames(version) };
const field = positionals[0];
if (field !== undefined) {
    if (!Object.hasOwn(info, field)) throw new Error(`Unknown release field: ${field}`);
    process.stdout.write(`${info[field]}\n`);
} else {
    for (const [key, value] of Object.entries(info)) process.stdout.write(`${key}=${value}\n`);
}
