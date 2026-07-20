import { renderStatisticsOverlayUi } from '@/ui/statistics-overlay';

const colorScheme = new URLSearchParams(location.search).get('colorScheme');

if (colorScheme === 'normal' || colorScheme === 'light' || colorScheme === 'dark') {
    document.documentElement.style.colorScheme = colorScheme;
} else if (colorScheme === 'none') {
    document.documentElement.style.colorScheme = 'light dark';
}

window.addEventListener('load', () => {
    const root = document.getElementById('root') as HTMLElement;
    renderStatisticsOverlayUi(root);
});
