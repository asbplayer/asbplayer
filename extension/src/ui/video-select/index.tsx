import { createRoot } from 'react-dom/client';
import Bridge from '@project/extension/src/ui/bridge';
import VideoSelectUi from '@project/extension/src/ui/components/VideoSelectUi';
import { i18nInit } from '@project/extension/src/ui/i18n';

export function renderVideoSelectModeUi(element: Element, language: string, locStrings: any) {
    const bridge = new Bridge();
    i18nInit(language, locStrings);
    createRoot(element).render(<VideoSelectUi bridge={bridge} />);
    return bridge;
}
