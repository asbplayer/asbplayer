import { renderFtueUi } from '@/ui/ftue';
import '@project/extension/src/entrypoints/video.content/video.css';
import { currentPageDelegate } from '@/services/pages';
import { configureExtensionLogProvider } from '@/services/extension-log-provider';

configureExtensionLogProvider();

window.addEventListener('load', () => {
    void currentPageDelegate().then((pageDelegate) => {
        pageDelegate.loadScripts();
    });
    const root = document.getElementById('root')!;
    renderFtueUi(root);
});
