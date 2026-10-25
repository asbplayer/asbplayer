import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { flatten, unflatten } from 'flat';

const dirname = fileURLToPath(new URL('.', import.meta.url));
const commonLocalesPath = join(dirname, '../../common/locales');
const extensionLocalesPath = join(dirname, '../../extension/public/_locales');
const externalLocalesPath = join(dirname, '../../loc/external');
const untranslatedPath = join(dirname, '../../loc/untranslated');
const notesPath = join(dirname, '../../loc/notes.json');

export const merge = (a, b) => {
    const merged = { ...a, ...b };

    for (const key of Object.keys(a)) {
        if (typeof a[key] !== 'object') {
            continue;
        }

        if (key in b) {
            merged[key] = merge(a[key], b[key]);
        }
    }

    return merged;
};

export async function supportedLocales() {
    const project = await readJson(join(dirname, '../../project.json'));
    return project.languages.map(({ code }) => code);
}

async function readJson(path) {
    return JSON.parse(await readFile(path, 'utf8'));
}

export async function flattenedLocJsonByNamespace(locale) {
    const common = await readJson(`${commonLocalesPath}/${locale}.json`);
    const extension = await readJson(`${extensionLocalesPath}/${locale}/messages.json`);
    const external = await readJson(`${externalLocalesPath}/${locale}.json`);
    return { common: flatten(common), extension: flatten(extension), external: flatten(external) };
}

async function updateWithFlattenedJson(path, locale, namespace, json) {
    const existing = await readJson(path);
    const update = unflatten(json);
    const untranslated = await readFlattenedUntranslatedKeysByNamespace(locale);

    for (const key of Object.keys(json)) {
        delete untranslated[namespace][key];
    }

    await writeFile(path, JSON.stringify(merge(existing, update), null, 4));
    await writeFile(`${untranslatedPath}/${locale}.json`, JSON.stringify(untranslated, null, 4));
}

export async function updateWithFlattenedLocJsonByNamespace(locale, flattenedLocJsonByNamespace) {
    await updateWithFlattenedJson(
        `${commonLocalesPath}/${locale}.json`,
        locale,
        'common',
        flattenedLocJsonByNamespace.common
    );
    await updateWithFlattenedJson(
        `${extensionLocalesPath}/${locale}/messages.json`,
        locale,
        'extension',
        flattenedLocJsonByNamespace.extension
    );
    await updateWithFlattenedJson(
        `${externalLocalesPath}/${locale}.json`,
        locale,
        'external',
        flattenedLocJsonByNamespace.external
    );
}

export async function flattenedNotesJsonByNamespace() {
    return await readJson(notesPath);
}

export async function readFlattenedUntranslatedKeysByNamespace(locale) {
    return JSON.parse(await readFile(`${untranslatedPath}/${locale}.json`));
}

export async function updateFlattenedUntranslatedKeys(locale, namespace, untranslated) {
    const current = await readFlattenedUntranslatedKeysByNamespace(locale);
    const updated = { ...current, [namespace]: { ...current[namespace], ...untranslated } };
    await writeFile(`${untranslatedPath}/${locale}.json`, JSON.stringify(updated, null, 4));
}
