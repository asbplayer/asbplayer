import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import AnkiUi from '../components/AnkiUi';
import { i18nInit } from '../i18n';

export function renderAnkiUi(element: Element, lang: string, locStrings: any) {
    const bridge = new Bridge();
    i18nInit(lang, locStrings);
    createRoot(element).render(<AnkiUi bridge={bridge} />);
    return bridge;
}
