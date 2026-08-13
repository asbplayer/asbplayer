import { createRoot } from 'react-dom/client';
import Bridge from '@project/extension/src/ui/bridge';
import AnkiUi from '@project/extension/src/ui/components/AnkiUi';
import { i18nInit } from '@project/extension/src/ui/i18n';

export function renderAnkiUi(element: Element, lang: string, locStrings: any) {
    const bridge = new Bridge();
    i18nInit(lang, locStrings);
    createRoot(element).render(<AnkiUi bridge={bridge} />);
    return bridge;
}
