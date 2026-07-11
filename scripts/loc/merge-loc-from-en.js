import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import { flatten } from 'flat';
import { updateFlattenedUntranslatedKeys, merge } from './locales.js';
const dirname = url.fileURLToPath(new URL('.', import.meta.url));
const localesPath = path.join(dirname, '../../common/locales');

const diff = (a, b) => {
    const flattenedA = flatten(a);
    const flattenedB = flatten(b);
    const difference = {};

    for (const key of Object.keys(flattenedA)) {
        if (!(key in flattenedB)) {
            difference[key] = a[key];
        }
    }

    return difference;
};

fs.readdir(localesPath, (err, files) => {
    if (err) {
        console.error(err);
        return;
    }

    const enLocale = JSON.parse(fs.readFileSync(`${localesPath}/en.json`));

    for (const f of files) {
        if (f === 'en.json') {
            continue;
        }

        const localePath = `${localesPath}/${f}`;
        const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));
        const mergedLocale = merge(enLocale, locale);
        const untranslated = diff(mergedLocale, locale);
        const code = /(.+)\.json/.exec(f)[1];
        updateFlattenedUntranslatedKeys(code, 'common', untranslated)
            .then(() => {
                fs.writeFileSync(localePath, JSON.stringify(mergedLocale, null, 4), 'utf8');
            })
            .catch(console.error);
    }
});
