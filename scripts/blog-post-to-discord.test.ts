import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

import {
    buildPayload,
    COMPONENTS_TEXT_LIMIT,
    convertPostFile,
    DOCS_BASE_URL,
    MESSAGE_FLAGS,
    normalizeRoleId,
    parsePost,
    slugFromFilePath,
    toDiscordMarkdown,
    type DiscordPayload,
} from './blog-post-to-discord.ts';

const samplePost = `---
slug: 1.21.0-released
title: Extension v1.21.0 released
authors: [killergerbah]
tags: []
---

Extension v1.21.0 has been released.

<!-- truncate -->

Thanks to [@ShanaryS](https://github.com/ShanaryS) and see the [guide](../docs/contributing).

#### A deeper heading
`;

function textOf(payload: DiscordPayload): string {
    return payload.components.map((component) => component.content).join('\n');
}

let tempDir: string | undefined;
function fixturePath(name: string, contents: string): string {
    if (!tempDir) tempDir = mkdtempSync(join(tmpdir(), 'blog-post-to-discord-'));
    const path = join(tempDir, name);
    writeFileSync(path, contents);
    return path;
}

after(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

describe('parsePost', () => {
    test('extracts frontmatter fields and body', () => {
        const post = parsePost(samplePost);
        assert.equal(post.title, 'Extension v1.21.0 released');
        assert.equal(post.slug, '1.21.0-released');
        assert.match(post.body, /Extension v1\.21\.0 has been released\./);
        assert.doesNotMatch(post.body, /^---/);
    });

    test('throws without frontmatter', () => {
        assert.throws(() => parsePost('# No frontmatter'), /frontmatter/);
    });
});

describe('slugFromFilePath', () => {
    test('strips the markdown extension', () => {
        assert.equal(slugFromFilePath('docs/blog/2026-9-23-1.21.0-released.mdx'), '2026-9-23-1.21.0-released');
        assert.equal(slugFromFilePath('docs/blog/foo.md'), 'foo');
    });
});

describe('normalizeRoleId', () => {
    test('accepts a bare snowflake', () => {
        assert.equal(normalizeRoleId('123456789'), '123456789');
    });

    test('accepts a role mention', () => {
        assert.equal(normalizeRoleId('<@&123456789>'), '123456789');
    });

    test('trims whitespace', () => {
        assert.equal(normalizeRoleId('  <@&123> '), '123');
    });

    test('rejects empty and invalid values', () => {
        assert.equal(normalizeRoleId(undefined), undefined);
        assert.equal(normalizeRoleId(''), undefined);
        assert.equal(normalizeRoleId('   '), undefined);
        assert.equal(normalizeRoleId('@subscribers'), undefined);
    });
});

describe('toDiscordMarkdown', () => {
    const options = { baseUrl: DOCS_BASE_URL, route: '/blog/1.21.0-released' };

    test('removes HTML comments including the truncate marker', () => {
        const markdown = toDiscordMarkdown(samplePost, options);
        assert.doesNotMatch(markdown, /truncate/);
        assert.doesNotMatch(markdown, /<!--/);
    });

    test('resolves relative links against the post URL', () => {
        const markdown = toDiscordMarkdown('[guide](../docs/contributing)', options);
        assert.equal(markdown, `[guide](${DOCS_BASE_URL}/docs/contributing)`);
    });

    test('leaves absolute links untouched', () => {
        const markdown = toDiscordMarkdown('[x](https://example.com/a)', options);
        assert.equal(markdown, '[x](https://example.com/a)');
    });

    test('resolves root-relative links', () => {
        const markdown = toDiscordMarkdown('[x](/docs/intro)', options);
        assert.equal(markdown, `[x](${DOCS_BASE_URL}/docs/intro)`);
    });

    test('keeps in-page anchors', () => {
        assert.equal(toDiscordMarkdown('[x](#section)', options), '[x](#section)');
    });

    test('converts images to masked links', () => {
        const markdown = toDiscordMarkdown('![logo](logo.png)', options);
        assert.equal(markdown, `[logo](${DOCS_BASE_URL}/blog/logo.png)`);
    });

    test('demotes H4+ to bold but keeps H1-H3', () => {
        const markdown = toDiscordMarkdown('# One\n## Two\n### Three\n#### Four', options);
        assert.equal(markdown, '# One\n## Two\n### Three\n**Four**');
    });

    test('strips MDX import/export lines', () => {
        const markdown = toDiscordMarkdown("import Foo from './foo';\nBody text", options);
        assert.equal(markdown, 'Body text');
    });
});

describe('buildPayload', () => {
    test('uses a components v2 text display with suppressed embeds', () => {
        const payload = buildPayload({ url: 'https://x/y', body: 'Body' });
        assert.equal(payload.flags, MESSAGE_FLAGS);
        assert.equal(payload.components[0].type, 10);
        assert.equal('embeds' in payload, false);
    });

    test('puts the role mention first and links the post at the end', () => {
        const payload = buildPayload({ url: 'https://x/y', body: 'Body', roleId: '123' });
        assert.equal(payload.components[0].content, '<@&123> New blog post:');
        assert.equal(payload.components[1].content, 'Body\n\n([read the full blog post](https://x/y))');
        assert.deepEqual(payload.allowed_mentions, { parse: [], roles: ['123'] });
    });

    test('omits the role mention and restricts mentions when unset', () => {
        const payload = buildPayload({ url: 'https://x/y', body: 'Body' });
        assert.equal(payload.components[0].content, 'New blog post:');
        assert.deepEqual(payload.allowed_mentions, { parse: [] });
    });

    test('honors a custom prefix', () => {
        const payload = buildPayload({ url: 'https://x/y', body: 'Body', prefix: 'Heads up:' });
        assert.equal(payload.components[0].content, 'Heads up:');
    });

    test('drops the header component when there is no mention or prefix', () => {
        const payload = buildPayload({ url: 'https://x/y', body: 'Body', prefix: '' });
        assert.equal(payload.components.length, 1);
        assert.equal(payload.components[0].content, 'Body\n\n([read the full blog post](https://x/y))');
    });

    test('keeps the footer when there is no body', () => {
        const payload = buildPayload({ url: 'https://x/y', body: '', roleId: '123' });
        assert.equal(payload.components[0].content, '<@&123> New blog post:');
        assert.equal(payload.components[1].content, '([read the full blog post](https://x/y))');
    });

    test('truncates long bodies and keeps the read-more footer', () => {
        const body = Array.from({ length: 200 }, (_, i) => `Line ${i} ${'x'.repeat(50)}`).join('\n');
        const payload = buildPayload({ url: 'https://x/y', body });
        const text = textOf(payload);
        assert.ok(text.length <= COMPONENTS_TEXT_LIMIT);
        assert.match(text, /…\n\n\(\[read the full blog post\]\(https:\/\/x\/y\)\)$/);
    });
});

describe('convertPostFile', () => {
    test('converts a blog post file into a payload', () => {
        const path = fixturePath('2026-9-23-1.21.0-released.mdx', samplePost);
        const payload = convertPostFile(path);
        const text = textOf(payload);
        assert.equal(payload.components[0].content, 'New blog post:');
        assert.match(text, /@ShanaryS/);
        assert.match(
            text,
            /\(\[read the full blog post\]\(https:\/\/docs\.asbplayer\.dev\/blog\/1\.21\.0-released\)\)$/
        );
    });

    test('falls back to the filename when frontmatter has no slug', () => {
        const path = fixturePath('2025-05-31-first-post.mdx', '---\ntitle: Hi\n---\n\nBody\n');
        const payload = convertPostFile(path);
        assert.match(textOf(payload), /https:\/\/docs\.asbplayer\.dev\/blog\/2025-05-31-first-post/);
    });
});

const filesFile = process.env.BLOG_POST_FILES_FILE;
if (filesFile && existsSync(filesFile)) {
    const files = readFileSync(filesFile, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    describe('new blog posts', () => {
        for (const file of files) {
            test(file, () => {
                const payload = convertPostFile(file);
                const text = textOf(payload);

                assert.equal(payload.flags, MESSAGE_FLAGS);
                assert.equal(payload.components[0].type, 10);
                assert.ok(text.length <= COMPONENTS_TEXT_LIMIT, 'text exceeds the components v2 limit');
                assert.match(
                    text,
                    /\(\[read the full blog post\]\(https:\/\/docs\.asbplayer\.dev\/blog\//,
                    'footer link is missing'
                );
                assert.doesNotMatch(text, /(^|\n)[ \t]*(?:import|export)\s/, 'MDX leaked into output');
                assert.doesNotMatch(text, /<!--/, 'HTML comment leaked into output');

                for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
                    assert.ok(/^(https?:\/\/|mailto:|#)/.test(target), `link target is not absolute: ${target}`);
                }
            });
        }
    });
}
