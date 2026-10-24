import project from '@project/common/project';
import { asbError } from '@project/common/util/log';
import type { ExtensionConfig, LocalizationConfig } from '@project/extension/src/services/extension-config';
import { fetchExtensionConfig } from '@project/extension/src/services/extension-config';
import { SettingsProvider, supportedLanguages as defaultSupportedLanguages } from '@project/common/settings';
import { ExtensionSettingsStorage } from '@project/extension/src/services/extension-settings-storage';
import bundledConfig from '@project/common/extension.json';
import type { PublicPath } from 'wxt/browser';

const stringsKeyForLang = (lang: string) => `locStrings-${lang}`;
const versionKeyForLang = (lang: string) => `locVersion-${lang}`;
const settings = new SettingsProvider(new ExtensionSettingsStorage());

export interface Localization {
    lang: string;
    strings: any;
}

export const fetchLocalization = async (lang: string): Promise<Localization> => {
    return (
        (await cachedStringsForLang(lang)) ??
        (await bundledStringsForLang(lang)) ??
        (await bundledStringsForLang(project.defaultLanguage))!
    );
};

export const fetchSupportedLanguages = async (): Promise<string[]> => {
    const config = await fetchExtensionConfig();

    if (config === undefined) {
        return defaultSupportedLanguages;
    }

    return config.languages.map((c) => c.code);
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

        const stringsKey = stringsKeyForLang(lang);
        const versionKey = versionKeyForLang(lang);

        if (langConfig.version <= bundledVersion(lang)) {
            // The bundled strings are at least as new as the deployed ones
            await browser.storage.local.remove([stringsKey, versionKey]);
            return;
        }

        const result = (await browser.storage.local.get([stringsKey, versionKey])) ?? {};
        const cachedVersion = result[versionKey] as number | undefined;

        if (result[stringsKey] === undefined || cachedVersion === undefined || cachedVersion < langConfig.version) {
            await fetchAndCache(langConfig);
        }
    } catch (e) {
        asbError('i18n', e);
    }
};

// Version of the language's strings that are bundled with this build, or -1 if the language is not bundled
const bundledVersion = (lang: string): number => {
    const bundled = (bundledConfig as ExtensionConfig).languages.find((c) => c.code === lang);
    return bundled?.version ?? -1;
};

const fetchAndCache = async ({ code, url, version }: LocalizationConfig): Promise<void> => {
    const asbplayerUrl = await settings.getSingle('streamingAppUrl');
    const effectiveUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `${asbplayerUrl}/${url}`;
    try {
        const remoteStrings = await (await fetch(effectiveUrl)).json();

        if (typeof remoteStrings === 'object' && remoteStrings !== null) {
            // Downloaded strings may have removed keys that this build still uses, so keep the bundled ones as a base
            const bundled =
                (await bundledStringsForLang(code)) ?? (await bundledStringsForLang(project.defaultLanguage))!;
            const strings = mergeStrings(bundled.strings, remoteStrings);
            await browser.storage.local.set({ [stringsKeyForLang(code)]: strings, [versionKeyForLang(code)]: version });
        }
    } catch (e) {
        asbError('i18n', e);
    }
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
    const versionKey = versionKeyForLang(lang);
    const result = (await browser.storage.local.get([stringsKey, versionKey])) ?? {};
    const strings = result[stringsKey];
    const cachedVersion = result[versionKey] as number | undefined;

    // Only use downloaded strings that are newer than the bundled ones, in case primeLocalization hasn't cleared
    // a stale cache yet (still running, or the config couldn't be fetched)
    if (strings === undefined || cachedVersion === undefined || cachedVersion <= bundledVersion(lang)) {
        return undefined;
    }

    return { lang, strings };
};
