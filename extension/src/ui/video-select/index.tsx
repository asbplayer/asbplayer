import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import VideoSelectUi from '../components/VideoSelectUi';
import { i18nInit } from '../i18n';

export function renderVideoSelectModeUi(element: Element, language: string, locStrings: any) {
    const bridge = new Bridge();
    i18nInit(language, locStrings);
    createRoot(element).render(<VideoSelectUi bridge={bridge} />);
    return bridge;
}
