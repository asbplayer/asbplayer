import { createRoot } from 'react-dom/client';
import Bridge from '@project/extension/src/ui/bridge';
import { i18nInit } from '@project/extension/src/ui/i18n';
import NotificationUi from '@project/extension/src/ui/components/NotificationUi';

export function renderNotificationUi(element: Element, lang: string, locStrings: any) {
    const bridge = new Bridge();
    i18nInit(lang, locStrings);
    createRoot(element).render(<NotificationUi bridge={bridge} />);
    return bridge;
}
