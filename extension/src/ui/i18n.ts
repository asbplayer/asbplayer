import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const i18nInit = (lang: string, locStrings: any) => {
    void i18n.use(initReactI18next).init({
        resources: { [lang]: { translation: locStrings } },
        lng: lang,
        fallbackLng: lang,
        debug: import.meta.env.MODE === 'development',
        ns: 'translation',
        defaultNS: 'translation',
        interpolation: {
            escapeValue: false,
        },
    });
};
