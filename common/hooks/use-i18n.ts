import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { useEffect, useState } from 'react';

let init: Promise<any> = i18n
    .use(resourcesToBackend((language: string) => import(`../../locales/${language}.json`)))
    .use(initReactI18next)
    .init({
        partialBundledLanguages: true,
        resources: {},
        fallbackLng: 'en',
        debug: import.meta.env.MODE === 'development',
        ns: 'translation',
        defaultNS: 'translation',
        interpolation: {
            escapeValue: false,
        },
    });

export const useI18n = ({ language }: { language: string }) => {
    const [initialized, setInitialized] = useState<boolean>(false);

    useEffect(() => {
        if (initialized) {
            return;
        }

        void init.then(() => setInitialized(true));
    }, [initialized]);

    useEffect(() => {
        init = init.then(() => i18n.changeLanguage(language)).catch((e) => console.error(e));
    }, [language]);

    return { initialized };
};
