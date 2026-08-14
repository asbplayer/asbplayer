import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import VideoDataSyncUi from '../components/VideoDataSyncUi';
import { i18nInit } from '../i18n';

export function renderVideoDataSyncUi(element: Element, language: string, locStrings: any) {
    const bridge = new Bridge();
    i18nInit(language, locStrings);
    createRoot(element).render(<VideoDataSyncUi bridge={bridge} />);
    return bridge;
}
