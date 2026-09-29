import { renderSidePanelUi } from '@/ui/side-panel';
import { configureExtensionLogProvider } from '@/services/extension-log-provider';

configureExtensionLogProvider();

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    renderSidePanelUi(root);
});
