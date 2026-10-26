import { releaseNames, runtimeVersion as version } from './release-names.mjs';

// Print one field for shell scripts, or all fields as GitHub Actions outputs.
const info = { version, ...releaseNames(version) };
const field = process.argv[2];
if (field !== undefined) {
    if (!Object.hasOwn(info, field)) throw new Error(`Unknown release field: ${field}`);
    process.stdout.write(`${info[field]}\n`);
} else {
    for (const [key, value] of Object.entries(info)) process.stdout.write(`${key}=${value}\n`);
}
