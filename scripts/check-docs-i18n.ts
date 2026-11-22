import { realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCS_SOURCE_DIR, localeTreeDir, localesForProject, readOptional, walkFiles } from './docs-i18n-files.ts';

type Violation = string;

const TRANSLATABLE_FRONTMATTER = new Set(['title', 'description']);

/** Flat frontmatter as key → value text; undefined when the file has no frontmatter block. */
function frontmatter(source: string): Record<string, string> | undefined {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
    if (!match) return undefined;
    const entries: Record<string, string> = {};
    for (const line of match[1].split(/\r?\n/)) {
        const key = /^([a-zA-Z_][a-zA-Z0-9_-]*):/.exec(line)?.[1];
        if (key !== undefined) entries[key] = line.slice(line.indexOf(':') + 1).trim();
    }
    return entries;
}

function fencedCodeBlocks(source: string): string[] {
    // Group 2 captures the bare fence marker; the closing fence must repeat the
    // marker, not the opening line's info string (```text title="…").
    return [...source.matchAll(/(^|\n)(```|~~~)[^\n]*\n([\s\S]*?)\n\2/g)].map((match) => match[3]);
}

/** MDX import/export statements load components and data; translating them breaks the build. */
function mdxImports(source: string): string[] {
    return source.split(/\r?\n/).filter((line) => line.startsWith('import ') || line.startsWith('export '));
}

function headingAnchors(source: string): string[] {
    return [...source.matchAll(/\{#([^}]+)\}/g)].map((match) => match[1]);
}

function withoutCode(source: string): string {
    // Fenced code and inline code hold regex examples and MDX expressions whose
    // brackets mimic markdown links; only prose carries translatable links.
    return source.replace(/(^|\n)(?:~~~|```)[^\n]*\n[\s\S]*?\n(?:~~~|```)/g, '$1').replace(/`[^`\n]*`/g, '');
}

/** Markdown link targets, excluding absolute URLs, mailto and hash-only links. */
function linkTargets(source: string): string[] {
    return [...withoutCode(source).matchAll(/\]\(([^)]+)\)/g)]
        .map((match) => match[1].trim())
        .filter(
            (target) => !target.startsWith('#') && !/^([a-z]+:)?\/\//.test(target) && !target.startsWith('mailto:')
        );
}

function checkStructure(prefix: string, english: string, translated: string): Violation[] {
    const violations: Violation[] = [];

    const englishFrontmatter = frontmatter(english);
    const translatedFrontmatter = frontmatter(translated);
    if (englishFrontmatter === undefined) {
        if (translatedFrontmatter !== undefined)
            violations.push(`${prefix}: frontmatter was added but the English source has none`);
    } else if (translatedFrontmatter === undefined) {
        violations.push(`${prefix}: frontmatter was removed`);
    } else {
        for (const key of Object.keys(englishFrontmatter)) {
            const expected = translatedFrontmatter[key];
            if (expected === undefined) {
                violations.push(`${prefix}: frontmatter key "${key}" was removed`);
            } else if (!TRANSLATABLE_FRONTMATTER.has(key) && expected !== englishFrontmatter[key]) {
                violations.push(`${prefix}: frontmatter value of "${key}" must stay byte-identical`);
            }
        }
        for (const key of Object.keys(translatedFrontmatter)) {
            if (englishFrontmatter[key] === undefined) violations.push(`${prefix}: frontmatter key "${key}" was added`);
        }
    }

    const translatedBlocks = fencedCodeBlocks(translated);
    for (const block of fencedCodeBlocks(english)) {
        if (!translatedBlocks.includes(block)) {
            violations.push(`${prefix}: fenced code block differs (\`${block.split('\n')[0].slice(0, 40)}…\`)`);
        }
    }

    const translatedImports = mdxImports(translated);
    for (const line of mdxImports(english)) {
        if (!translatedImports.includes(line)) {
            violations.push(`${prefix}: MDX import/export line was altered (\`${line.slice(0, 60)}…\`)`);
        }
    }

    const translatedAnchors = headingAnchors(translated);
    for (const anchor of headingAnchors(english)) {
        if (!translatedAnchors.includes(anchor)) {
            violations.push(`${prefix}: heading anchor {#${anchor}} was removed`);
        }
    }

    const translatedTargets = linkTargets(translated);
    for (const target of linkTargets(english)) {
        if (!translatedTargets.includes(target)) {
            violations.push(`${prefix}: link target ${target} was removed or altered`);
        }
    }
    return violations;
}

function checkTree(root: string, locale: string, sourceFiles: string[], sources: Map<string, string>): Violation[] {
    const violations: Violation[] = [];
    const treeDir = join(root, localeTreeDir(locale));
    const treeFiles = walkFiles(treeDir) ?? [];

    for (const missing of sourceFiles.filter((file) => !treeFiles.includes(file))) {
        violations.push(`${locale}: missing locale copy of docs/docs/${missing}`);
    }
    for (const extra of treeFiles.filter((file) => !sourceFiles.includes(file))) {
        violations.push(`${locale}: no English source for ${localeTreeDir(locale)}/${extra}; delete it`);
    }

    for (const file of sourceFiles) {
        const translated = readOptional(join(treeDir, file));
        if (translated === undefined) continue;
        const english = sources.get(file)!;
        const prefix = `${locale}/${file}`;

        // JSON metadata (_category_.json) is generated by pnpm sync:project; category
        // labels translate via current.json, so the copies must stay byte-identical.
        if (file.endsWith('.json')) {
            if (translated !== english) {
                violations.push(`${prefix}: must stay byte-identical to docs/docs/${file}; run pnpm sync:project`);
            }
            continue;
        }

        violations.push(...checkStructure(prefix, english, translated));
    }
    return violations;
}

/** Every preserved relative link target must resolve inside the same locale tree. */
function checkLinks(root: string, locales: string[]): Violation[] {
    const violations: Violation[] = [];
    for (const locale of locales) {
        const treeDir = join(root, localeTreeDir(locale));
        for (const file of walkFiles(treeDir) ?? []) {
            if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
            const contents = readOptional(join(treeDir, file));
            if (contents === undefined) continue;
            for (const target of linkTargets(contents)) {
                if (target.startsWith('/')) continue; // site-absolute paths are not file-relative
                const stripped = target.split('#')[0].replace(/\/$/, '');
                if (stripped.length === 0) continue;
                const base = join(dirname(file), stripped);
                const candidates = [base, `${base}.md`, `${base}.mdx`];
                if (candidates.every((candidate) => readOptional(join(treeDir, candidate)) === undefined)) {
                    violations.push(`${locale}/${file}: broken internal link ${target}`);
                }
            }
        }
    }
    return violations;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const locales = localesForProject(root);
    const sourceFiles = walkFiles(join(root, DOCS_SOURCE_DIR)) ?? [];
    const sources = new Map(sourceFiles.map((file) => [file, readOptional(join(root, DOCS_SOURCE_DIR, file)) ?? '']));

    const violations = [
        ...locales.flatMap((locale) => checkTree(root, locale, sourceFiles, sources)),
        ...checkLinks(root, locales),
    ];
    for (const violation of violations) {
        console.error(violation);
    }
    if (violations.length > 0) {
        console.error('^^^^ docs i18n validation failed ^^^^');
        process.exitCode = 1;
    } else {
        console.log(`Docs i18n OK (${locales.length} locales, ${sourceFiles.length} source files).`);
    }
}
