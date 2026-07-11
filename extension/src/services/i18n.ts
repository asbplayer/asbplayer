import i18n, { TFunction } from 'i18next';
import { fetchLocalization } from './localization-fetcher';

let initializedPromise: Promise<void> | undefined;

const langsInitialized: { [key: string]: string } = {};

export const i18nInit = async (lang: string): Promise<TFunction<['translation', ...string[]], undefined>> => {
    if (initializedPromise) {
        await initializedPromise;
        const notAddedYet = !(lang in langsInitialized);

        if (notAddedYet) {
            const loc = await fetchLocalization(lang);
            i18n.addResourceBundle(loc.lang, 'translation', loc.strings);
            langsInitialized[lang] = loc.lang;
        }

        // If a localization doesn't exist for lang then actualLanguage will be a fallback language
        const actualLanguage = langsInitialized[lang];

        if (i18n.language !== actualLanguage) {
            await i18n.changeLanguage(actualLanguage);
        }

        return i18n.t;
    }

    initializedPromise = (async () => {
        const loc = await fetchLocalization(lang);
        await i18n.init({
            resources: { [loc.lang]: { translation: loc.strings } },
            lng: loc.lang,
            fallbackLng: loc.lang,
            debug: import.meta.env.MODE === 'development',
            ns: 'translation',
            defaultNS: 'translation',
            interpolation: {
                escapeValue: false,
            },
        });
        langsInitialized[lang] = loc.lang;
    })();

    await initializedPromise;
    return i18n.t;
};
