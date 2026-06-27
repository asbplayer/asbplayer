import { renderStatisticsUi } from '@/ui/statistics';

window.addEventListener('load', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderStatisticsUi(root);
});
