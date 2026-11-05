import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import { supportedLocales } from './locales.js';
const dirname = url.fileURLToPath(new URL('.', import.meta.url));
const localesPath = path.join(dirname, '../../common/locales');

const removeKey = (locale, key) => {
    const path = key.split('.');
    let curr = locale;
    for (let i = 0; i < path.length - 1; i++) {
        const keyPart = path[i];
        curr = locale[keyPart];
    }
    const lastKeyPart = path[path.length - 1];
    delete curr[lastKeyPart];
};

const removeKeys = (locale, keysToRemove) => {
    for (const key of keysToRemove) {
        removeKey(locale, key);
    }
};

const files = (await supportedLocales()).map((code) => `${code}.json`);
if (process.argv.length <= 1) {
    process.exit(0);
}

const keysToRemove = process.argv.slice(2);

for (const f of files) {
    if (f === 'en.json') {
        continue;
    }

    const localePath = `${localesPath}/${f}`;
    const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));
    removeKeys(locale, keysToRemove);
    fs.writeFileSync(localePath, JSON.stringify(locale, null, 4), 'utf8');
}
