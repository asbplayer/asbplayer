import { renderMobileVideoOverlay } from '@/ui/mobile-video-overlay';

const params = new URLSearchParams(location.search);
const colorScheme = params.get('colorScheme');

if (colorScheme === 'normal' || colorScheme === 'light' || colorScheme === 'dark') {
    document.documentElement.style.colorScheme = colorScheme;
} else if (colorScheme === 'none') {
    document.documentElement.style.colorScheme = 'light dark';
}

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    const anchor = params.get('anchor');

    const scrollBufferDiv = document.createElement('div');
    scrollBufferDiv.className = 'asbplayer-mobile-video-overlay-scroll-buffer';

    // Add div above or below the overlay to support scrolling the overlay out of view
    if (anchor === 'bottom') {
        root.style.bottom = '0px';
        document.body.prepend(scrollBufferDiv);
    } else {
        root.style.top = '0px';
        document.body.appendChild(scrollBufferDiv);
    }

    void renderMobileVideoOverlay(root);
});
