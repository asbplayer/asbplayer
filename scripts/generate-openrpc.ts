#!/usr/bin/env node
// Generates external-api/openrpc.json from the zod schemas in common/external-commands/external-api.ts.
// Run `pnpm run generate:external-api` to regenerate, or `pnpm run check:external-api` (also wired into CI)
// to fail when the committed document has drifted from the schemas.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateOpenRpcDocument, serializeOpenRpcDocument } from '../common/external-commands/external-api.ts';

/** Check or update the committed OpenRPC document. Returns true when it matches the schemas. */
export function syncOpenRpcDocument(root: string, check = false): boolean {
    const path = join(root, 'external-api', 'openrpc.json');
    const contents = serializeOpenRpcDocument(generateOpenRpcDocument());
    let existing: string | undefined;

    try {
        existing = readFileSync(path, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    if (existing === contents) {
        return true;
    }

    if (!check) {
        writeFileSync(path, contents);
    }

    return false;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const check = process.argv.includes('--check');

    if (!syncOpenRpcDocument(fileURLToPath(new URL('../', import.meta.url)), check) && check) {
        process.stderr.write(
            'external-api/openrpc.json has drifted from the schemas in common/external-commands/external-api.ts. ' +
                'Run `pnpm run generate:external-api`.\n'
        );
        process.exitCode = 1;
    }
}
