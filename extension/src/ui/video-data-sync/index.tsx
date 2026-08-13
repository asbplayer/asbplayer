import { createRoot } from 'react-dom/client';
import Bridge from '@project/extension/src/ui/bridge';
import VideoDataSyncUi from '@project/extension/src/ui/components/VideoDataSyncUi';
import { i18nInit } from '@project/extension/src/ui/i18n';

export function renderVideoDataSyncUi(element: Element, language: string, locStrings: any) {
    const bridge = new Bridge();
    i18nInit(language, locStrings);
    createRoot(element).render(<VideoDataSyncUi bridge={bridge} />);
    return bridge;
}
