#!/usr/bin/env node
// Generates the committed OpenRPC documents from the zod schemas in
// common/external-commands/external-api.ts. Run `pnpm run generate:external-api` to regenerate,
// or `pnpm run check:external-api` (also wired into CI) to fail on drift.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { externalApiMethods, externalExtensionPortName } from '../common/external-commands/external-api.ts';
import { generateOpenRpcDocument, serializeOpenRpcDocument } from '../common/external-commands/openrpc.ts';

const documentPaths = ['external-api/openrpc.json', 'common/external-commands/openrpc-document.json'];

/** Check or update the committed OpenRPC documents. Returns true when they match the schemas. */
export function syncOpenRpcDocument(root: string, check = false): boolean {
    const contents = serializeOpenRpcDocument(
        generateOpenRpcDocument({ methods: externalApiMethods, externalExtensionPortName })
    );
    let matches = true;

    for (const relativePath of documentPaths) {
        const path = join(root, relativePath);
        let existing: string | undefined;

        try {
            existing = readFileSync(path, 'utf8');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }

        if (existing === contents) {
            continue;
        }

        matches = false;

        if (!check) {
            writeFileSync(path, contents);
        }
    }

    return matches;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const check = process.argv.includes('--check');

    if (!syncOpenRpcDocument(fileURLToPath(new URL('../', import.meta.url)), check) && check) {
        process.stderr.write(
            'The committed OpenRPC documents have drifted from the schemas in ' +
                'common/external-commands/external-api.ts. Run `pnpm run generate:external-api`.\n'
        );
        process.exitCode = 1;
    }
}
