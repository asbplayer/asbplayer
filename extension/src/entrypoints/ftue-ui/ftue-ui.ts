import { renderFtueUi } from '@/ui/ftue';
import '@project/extension/src/entrypoints/video.content/video.css';
import { currentPageDelegate } from '@/services/pages';
import { asbError } from '@project/common/util/log';
import { configureExtensionLogProvider } from '@/services/extension-log-provider';

configureExtensionLogProvider();

window.addEventListener('load', () => {
    void currentPageDelegate()
        .then((pageDelegate) => pageDelegate.loadScripts())
        .catch((error) => asbError('ftue', 'Failed to load page integration:', error));
    const root = document.getElementById('root')!;
    renderFtueUi(root);
});
