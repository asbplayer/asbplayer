import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { syncOpenRpcDocument } from './generate-openrpc.ts';

const documentPath = (root: string) => join(root, 'external-api', 'openrpc.json');

test('writes the generated document, detects drift, and never writes in check mode', () => {
    const root = mkdtempSync(join(tmpdir(), 'asbplayer-openrpc-'));

    try {
        mkdirSync(join(root, 'external-api'), { recursive: true });

        assert.equal(syncOpenRpcDocument(root, true), false);
        assert.equal(syncOpenRpcDocument(root), false);

        const document = JSON.parse(readFileSync(documentPath(root), 'utf8')) as {
            methods: { name: string }[];
        };

        assert.ok(document.methods.some(({ name }) => name === 'mine-subtitle'));
        assert.equal(syncOpenRpcDocument(root, true), true);

        writeFileSync(documentPath(root), '{}\n');

        assert.equal(syncOpenRpcDocument(root, true), false);
        assert.equal(readFileSync(documentPath(root), 'utf8'), '{}\n');
        assert.equal(syncOpenRpcDocument(root), false);
        assert.equal(syncOpenRpcDocument(root, true), true);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});

test('the committed document matches the schema registry', () => {
    assert.equal(syncOpenRpcDocument(fileURLToPath(new URL('..', import.meta.url)), true), true);
});
