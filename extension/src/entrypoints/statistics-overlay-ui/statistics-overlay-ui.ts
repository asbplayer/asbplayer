import { renderStatisticsOverlayUi } from '@/ui/statistics-overlay';
import { configureExtensionLogProvider } from '@/services/extension-log-provider';

configureExtensionLogProvider();

window.addEventListener('load', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderStatisticsOverlayUi(root);
});
