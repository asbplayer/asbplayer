import { renderStatisticsUi } from '@/ui/statistics';
import { configureExtensionLogProvider } from '@/services/extension-log-provider';

configureExtensionLogProvider();

window.addEventListener('load', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderStatisticsUi(root);
});
