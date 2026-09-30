import FrameBridgeServer from '@/services/frame-bridge-server';
import { renderStatisticsOverlayOneUncollectedUi } from '@/ui/statistics-overlay-one-uncollected';
import { configureExtensionLogProvider } from '@/services/extension-log-provider';

configureExtensionLogProvider();

window.addEventListener('load', () => {
    const root = document.getElementById('root') as HTMLElement;
    const bridge = renderStatisticsOverlayOneUncollectedUi(root);
    const listener = new FrameBridgeServer(bridge);
    listener.bind();
    window.addEventListener('unload', () => {
        listener.unbind();
    });
});
