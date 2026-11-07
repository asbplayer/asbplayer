import { join } from 'path';
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { supportedLocales, flattenedLocJsonByNamespace } from './locales.js';

const dirname = fileURLToPath(new URL('.', import.meta.url));
const untranslatedPath = join(dirname, '../../loc/untranslated');
const en = await flattenedLocJsonByNamespace('en');
const locales = await supportedLocales();

for (const locale of locales) {
    const targetByNamespace = await flattenedLocJsonByNamespace(locale);
    const untranslated = { common: {}, extension: {}, external: {} };

    for (const namespace of Object.keys(targetByNamespace)) {
        const target = targetByNamespace[namespace];
        for (const key of Object.keys(target)) {
            if (target[key] === en[namespace][key]) {
                untranslated[namespace][key] = en[namespace][key];
            }
        }
    }

    await writeFile(`${untranslatedPath}/${locale}.json`, JSON.stringify(untranslated, null, 4) + '\n');
}
