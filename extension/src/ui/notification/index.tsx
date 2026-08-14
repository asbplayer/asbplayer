import { createRoot } from 'react-dom/client';
import Bridge from '../bridge';
import { i18nInit } from '../i18n';
import NotificationUi from '../components/NotificationUi';

export function renderNotificationUi(element: Element, lang: string, locStrings: any) {
    const bridge = new Bridge();
    i18nInit(lang, locStrings);
    createRoot(element).render(<NotificationUi bridge={bridge} />);
    return bridge;
}
