import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { docsLocales } from './docs-locales.ts';

export const DOCS_SOURCE_DIR = 'docs/docs';
export const DOCS_I18N_DIR = 'docs/i18n';

/**
 * Locale subtree that mirrors docs/docs; Docusaurus serves this per-locale and
 * 404s any file missing from it, so the mirror must stay exact.
 */
export function localeTreeDir(locale: string): string {
    return join(DOCS_I18N_DIR, locale, 'docusaurus-plugin-content-docs/current');
}

/** Relative paths of every file under dir, or undefined when dir does not exist. */
export function walkFiles(dir: string): string[] | undefined {
    let names: string[];
    try {
        names = readdirSync(dir);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return undefined;
    }
    const files: string[] = [];
    for (const name of names) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            const nested = walkFiles(path);
            files.push(...(nested ?? []).map((file) => `${name}/${file}`));
        } else {
            files.push(name);
        }
    }
    return files;
}

export function readOptional(path: string): string | undefined {
    try {
        return readFileSync(path, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return undefined;
    }
}

export function sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

/** Reads project.json and returns the non-English Docusaurus locales. */
export function localesForProject(root: string): string[] {
    const project = JSON.parse(readFileSync(join(root, 'project.json'), 'utf8'));
    return docsLocales(project.languages);
}

/**
 * Parses the shared --locales=<a,b> flag: a comma-separated subset of the
 * configured locales, or all of them when the flag is absent. Exits when a
 * requested locale is not configured.
 */
export function parseLocalesArg(argv: string[], configured: string[]): string[] {
    const localeArg = /^--locales=(.+)$/.exec(argv.find((arg) => arg.startsWith('--locales=')) ?? '');
    const locales = localeArg
        ? localeArg[1]
              .split(',')
              .map((locale) => locale.trim())
              .filter(Boolean)
        : configured;
    for (const locale of locales) {
        if (!configured.includes(locale)) {
            console.error(`Locale "${locale}" is not configured in project.json`);
            process.exit(1);
        }
    }
    return locales;
}
