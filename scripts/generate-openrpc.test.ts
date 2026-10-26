import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { syncOpenRpcDocument } from './generate-openrpc.ts';

const documentPaths = (root: string) => [
    join(root, 'external-api', 'openrpc.json'),
    join(root, 'common', 'external-commands', 'openrpc-document.json'),
];

test('writes the generated documents, detects drift, and never writes in check mode', () => {
    const root = mkdtempSync(join(tmpdir(), 'asbplayer-openrpc-'));

    try {
        mkdirSync(join(root, 'external-api'), { recursive: true });
        mkdirSync(join(root, 'common', 'external-commands'), { recursive: true });

        assert.equal(syncOpenRpcDocument(root, true), false);
        assert.equal(syncOpenRpcDocument(root), false);

        const document = JSON.parse(readFileSync(documentPaths(root)[0], 'utf8')) as {
            methods: { name: string }[];
        };

        assert.ok(document.methods.some(({ name }) => name === 'mine-subtitle'));
        assert.equal(readFileSync(documentPaths(root)[0], 'utf8'), readFileSync(documentPaths(root)[1], 'utf8'));
        assert.equal(syncOpenRpcDocument(root, true), true);

        writeFileSync(documentPaths(root)[0], '{}\n');

        assert.equal(syncOpenRpcDocument(root, true), false);
        assert.equal(readFileSync(documentPaths(root)[0], 'utf8'), '{}\n');
        assert.equal(syncOpenRpcDocument(root), false);
        assert.equal(syncOpenRpcDocument(root, true), true);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('the committed document matches the schema registry', () => {
    assert.equal(syncOpenRpcDocument(fileURLToPath(new URL('..', import.meta.url)), true), true);
});
