import { renderStatisticsOverlayUi } from '@/ui/statistics-overlay';

window.addEventListener('load', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderStatisticsOverlayUi(root);
});
