import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import { flatten } from 'flat';
import { updateFlattenedUntranslatedKeys, merge } from './locales.js';
const dirname = url.fileURLToPath(new URL('.', import.meta.url));
const localesPath = path.join(dirname, '../../common/locales');

const updateKey = (locale, key, value) => {
    const path = key.split('.');
    let curr = locale;
    for (let i = 0; i < path.length - 1; i++) {
        const keyPart = path[i];
        curr = locale[keyPart];
    }
    const lastKeyPart = path[path.length - 1];
    curr[lastKeyPart] = value;
};

const getKey = (locale, key) => {
    const path = key.split('.');
    let curr = locale;
    for (let i = 0; i < path.length - 1; i++) {
        const keyPart = path[i];
        curr = locale[keyPart];
    }
    const lastKeyPart = path[path.length - 1];
    return curr[lastKeyPart];
};

fs.readdir(localesPath, (err, files) => {
    if (err) {
        console.error(err);
        return;
    }

    if (process.argv.length <= 1) {
        return;
    }

    const key = process.argv[2];

    if (!key) {
        throw new Error(`usage: ${process.argv[1]} <key to update from English text>`);
    }

    let enValue = '';

    for (const f of files) {
        if (f !== 'en.json') {
            continue;
        }
        const localePath = `${localesPath}/${f}`;
        const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));
        enValue = getKey(locale, key);
        break;
    }

    if (!enValue) {
        throw new Error('key not found in en.json');
    }

    for (const f of files) {
        if (f === 'en.json') {
            continue;
        }

        const localePath = `${localesPath}/${f}`;
        const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));
        updateKey(locale, key, enValue);
        fs.writeFileSync(localePath, JSON.stringify(locale, null, 4), 'utf8');
    }
});
