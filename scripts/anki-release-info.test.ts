import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ankiReleaseInfo } from './anki-release-info.ts';

const artifact = {
    package: 'example-addon',
    releaseTitle: 'example-ankiaddon-v{{version}}',
    artifact: 'example-player-{{version}}.ankiaddon',
    version: '2.3.4',
    minPointVersion: '25.02',
    releaseTag: 'custom-anki-v{{version}}',
};

test('expands release metadata fields', () => {
    assert.deepEqual(ankiReleaseInfo(artifact), {
        version: '2.3.4',
        filename: 'example-player-2.3.4.ankiaddon',
        tag: 'custom-anki-v2.3.4',
        title: 'example-ankiaddon-v2.3.4',
    });
});

test('rejects release metadata that could escape the output directory or corrupt workflow outputs', () => {
    for (const filename of ['../outside', 'nested/addon', 'nested\\addon', 'addon\0', 'addon\nfilename=other']) {
        assert.throws(() => ankiReleaseInfo({ ...artifact, artifact: filename }), /filename|newlines/);
    }
    assert.throws(() => ankiReleaseInfo({ ...artifact, releaseTitle: 'addon\ntitle=other' }), /newlines/);
    assert.throws(() => ankiReleaseInfo({ ...artifact, releaseTag: 'tag\rtitle=other' }), /newlines/);
});
