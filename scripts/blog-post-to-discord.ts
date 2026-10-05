import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DOCS_BASE_URL = 'https://docs.asbplayer.dev';
export const DEFAULT_PREFIX = 'New blog post:';
export const COMPONENTS_TEXT_LIMIT = 4000;
export const MESSAGE_FLAGS = (1 << 15) | (1 << 2); // IS_COMPONENTS_V2 | SUPPRESS_EMBEDS

export type BlogPost = {
    title: string;
    slug: string;
    body: string;
};

export type TextDisplayComponent = { type: 10; content: string };

export type DiscordPayload = {
    flags: number;
    components: TextDisplayComponent[];
    allowed_mentions: { parse: string[]; roles?: string[] };
};

function stripQuotes(value: string): string {
    return value.replace(/^['"]|['"]$/g, '');
}

function frontmatterValue(frontmatter: string, key: string): string {
    const match = frontmatter.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
    return match ? stripQuotes(match[1].trim()) : '';
}

export function parsePost(mdx: string): BlogPost {
    const match = mdx.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) throw new Error('Blog post is missing frontmatter');
    return {
        title: frontmatterValue(match[1], 'title'),
        slug: frontmatterValue(match[1], 'slug'),
        body: mdx.slice(match[0].length),
    };
}

export function slugFromFilePath(filePath: string): string {
    return basename(filePath).replace(/\.(md|mdx)$/, '');
}

export function normalizeRoleId(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const mention = trimmed.match(/^<@&(\d+)>$/);
    if (mention) return mention[1];
    if (/^\d+$/.test(trimmed)) return trimmed;
    return undefined;
}

function resolveUrl(target: string, base: string): string {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) return target;
    try {
        return new URL(target, base).href;
    } catch {
        return target;
    }
}

function truncateBody(body: string, budget: number): string {
    if (body.length <= budget) return body;
    if (budget <= 1) return '…'.slice(0, Math.max(budget, 0));
    const cut = body.slice(0, budget - 1).trimEnd();
    const lastNewline = cut.lastIndexOf('\n');
    const atLine = lastNewline > 0 ? cut.slice(0, lastNewline).trimEnd() : cut;
    return `${atLine}…`;
}

export function toDiscordMarkdown(body: string, { baseUrl, route }: { baseUrl: string; route: string }): string {
    const base = `${baseUrl}${route}`;
    let markdown = body
        .replace(/\r\n/g, '\n')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/^[ \t]*(?:import|export)\b.*$/gm, '');

    markdown = markdown.replace(
        /!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+['"][^'"]*['"])?\s*\)/g,
        (_match, alt: string, target: string) => {
            const label = alt.trim() || 'image';
            return `[${label}](${resolveUrl(target, base)})`;
        }
    );

    markdown = markdown.replace(
        /\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+['"][^'"]*['"])?\s*\)/g,
        (match, label: string, target: string) => {
            if (target.startsWith('#')) return match;
            return `[${label}](${resolveUrl(target, base)})`;
        }
    );

    markdown = markdown.replace(/^#{4,6}[ \t]+(.+)$/gm, (_match, text: string) => `**${text.trim()}**`);
    markdown = markdown.replace(/<\/?[A-Z][^>]*>/g, '');
    markdown = markdown.replace(/<\/?[a-z][a-zA-Z0-9]*\s[^>]*>/g, '');
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    return markdown.trim();
}

export type BuildPayloadOptions = {
    url: string;
    body: string;
    prefix?: string;
    roleId?: string;
};

export function buildPayload({ url, body, prefix = DEFAULT_PREFIX, roleId }: BuildPayloadOptions): DiscordPayload {
    const mention = roleId ? `<@&${roleId}>` : '';
    const header = [mention, prefix.trim()].filter(Boolean).join(' ');
    const footer = `([read the full blog post](${url}))`;

    const budget = Math.max(COMPONENTS_TEXT_LIMIT - header.length - footer.length, 0);
    const fittedBody = truncateBody(body, budget);
    const content = fittedBody ? `${fittedBody}\n\n${footer}` : footer;

    const components: TextDisplayComponent[] = [];
    if (header) components.push({ type: 10, content: header });
    components.push({ type: 10, content: content });

    const allowed_mentions: DiscordPayload['allowed_mentions'] = { parse: [] };
    if (roleId) allowed_mentions.roles = [roleId];

    return { flags: MESSAGE_FLAGS, components, allowed_mentions };
}

export function convertPostFile(filePath: string, prefix = DEFAULT_PREFIX): DiscordPayload {
    const { slug: frontmatterSlug, body } = parsePost(readFileSync(filePath, 'utf8'));
    const slug = frontmatterSlug || slugFromFilePath(filePath);
    const route = `/blog/${slug}`;
    return buildPayload({
        url: `${DOCS_BASE_URL}${route}`,
        body: toDiscordMarkdown(body, { baseUrl: DOCS_BASE_URL, route }),
        prefix,
        roleId: normalizeRoleId(process.env.DISCORD_ROLE_ANNOUNCEMENT_SUBSCRIBER),
    });
}

function main(): void {
    const [file, prefix] = process.argv.slice(2);
    if (!file) {
        console.error('Usage: blog-post-to-discord.ts <blog-post.mdx> [prefix]');
        process.exitCode = 1;
        return;
    }

    const role = process.env.DISCORD_ROLE_ANNOUNCEMENT_SUBSCRIBER;
    if (role && !normalizeRoleId(role)) {
        console.error(`Ignoring invalid DISCORD_ROLE_ANNOUNCEMENT_SUBSCRIBER: ${role}`);
    }

    process.stdout.write(`${JSON.stringify(convertPostFile(file, prefix))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
