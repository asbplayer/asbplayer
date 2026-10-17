import { asbError } from '@project/common/util/log';
import type { LocalizationConfig } from '@project/extension/src/services/extension-config';
import { fetchExtensionConfig } from '@project/extension/src/services/extension-config';
import { SettingsProvider, supportedLanguages as defaultSupportedLanguages } from '@project/common/settings';
import { ExtensionSettingsStorage } from '@project/extension/src/services/extension-settings-storage';
import type { PublicPath } from 'wxt/browser';

// locRemote: strings as downloaded, locStrings: remote strings merged over bundled strings (what the UI reads)
const stringsKeyPrefix = 'locStrings-';
const remoteKeyPrefix = 'locRemote-';
const stringsKeyForLang = (lang: string) => `${stringsKeyPrefix}${lang}`;
const remoteKeyForLang = (lang: string) => `${remoteKeyPrefix}${lang}`;
const versionKeyForLang = (lang: string) => `locVersion-${lang}`;
const settings = new SettingsProvider(new ExtensionSettingsStorage());

export interface Localization {
    lang: string;
    strings: any;
}

export const fetchLocalization = async (lang: string): Promise<Localization> => {
    // Set WXT_BUNDLED_LOCALES=true to use only bundled strings, to preview edited strings before they are deployed
    if (import.meta.env.WXT_BUNDLED_LOCALES === 'true') {
        return (await bundledStringsForLang(lang)) ?? (await bundledStringsForLang('en'))!;
    }

    return (
        (await cachedStringsForLang(lang)) ??
        (await bundledStringsForLang(lang)) ??
        (await bundledStringsForLang('en'))!
    );
};

export const fetchSupportedLanguages = async (): Promise<string[]> => {
    const config = await fetchExtensionConfig();

    if (config === undefined) {
        return defaultSupportedLanguages;
    }

    return config.languages.map((c) => c.code);
};

// Rebuilds the merged strings for every language that has stored remote strings. Needs no network access.
// Called on install and update, since the bundled strings may have changed.
export const rebuildLocalizationCache = async (): Promise<void> => {
    try {
        const all = (await browser.storage.local.get(null)) ?? {};

        for (const key of Object.keys(all)) {
            if (key.startsWith(remoteKeyPrefix)) {
                const lang = key.slice(remoteKeyPrefix.length);
                await mergeAndCache(lang, all[key]);
            }
        }
    } catch (e) {
        asbError('i18n', e);
    }
};

export const primeLocalization = async (lang: string): Promise<void> => {
    try {
        const config = await fetchExtensionConfig();

        if (config === undefined) {
            return;
        }

        const langConfig =
            config.languages.find((c) => c.code === lang) ??
            (await fetchExtensionConfig(true))?.languages.find((c) => c.code === lang);

        if (langConfig === undefined) {
            return;
        }

        const versionKey = versionKeyForLang(lang);
        const remoteKey = remoteKeyForLang(lang);
        const stringsKey = stringsKeyForLang(lang);
        const result = (await browser.storage.local.get([versionKey, remoteKey, stringsKey])) ?? {};
        const version = result[versionKey] as number | undefined;

        if (version === undefined || result[remoteKey] === undefined || version < langConfig.version) {
            await fetchAndCache(langConfig);
        } else if (result[stringsKey] === undefined) {
            await mergeAndCache(lang, result[remoteKey]);
        }
    } catch (e) {
        asbError('i18n', e);
    }
};

const fetchAndCache = async ({ code, url, version }: LocalizationConfig): Promise<void> => {
    const asbplayerUrl = await settings.getSingle('streamingAppUrl');
    const effectiveUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `${asbplayerUrl}/${url}`;
    try {
        const remoteStrings = await (await fetch(effectiveUrl)).json();

        if (typeof remoteStrings === 'object' && remoteStrings !== null) {
            await browser.storage.local.set({
                [remoteKeyForLang(code)]: remoteStrings,
                [versionKeyForLang(code)]: version,
            });
            await mergeAndCache(code, remoteStrings);
        }
    } catch (e) {
        asbError('i18n', e);
    }
};

// The remote strings can lag behind the bundled strings, so merge them over the bundled ones.
const mergeAndCache = async (lang: string, remoteStrings: any): Promise<void> => {
    const bundled = (await bundledStringsForLang(lang)) ?? (await bundledStringsForLang('en'))!;
    const strings = mergeStrings(bundled.strings, remoteStrings);
    await browser.storage.local.set({ [stringsKeyForLang(lang)]: strings });
};

const mergeStrings = (base: any, override: any): any => {
    const merged = { ...base, ...override };

    for (const key of Object.keys(base)) {
        if (
            key in override &&
            typeof base[key] === 'object' &&
            base[key] !== null &&
            typeof override[key] === 'object' &&
            override[key] !== null
        ) {
            merged[key] = mergeStrings(base[key], override[key]);
        }
    }

    return merged;
};

const bundledStringsForLang = async (lang: string): Promise<Localization | undefined> => {
    for (const defaultLang of defaultSupportedLanguages) {
        if (lang === defaultLang) {
            return {
                lang,
                strings: await (
                    await fetch(browser.runtime.getURL(`/asbplayer-locales/${lang}.json` as PublicPath))
                ).json(),
            };
        }
    }

    return undefined;
};

const cachedStringsForLang = async (lang: string): Promise<Localization | undefined> => {
    const stringsKey = stringsKeyForLang(lang);
    const result = await browser.storage.local.get(stringsKey);
    const strings = result ? result[stringsKey] : undefined;

    if (strings === undefined) {
        return undefined;
    }

    return { lang, strings };
};
