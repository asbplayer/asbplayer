import { renderMobileVideoOverlay } from '@/ui/mobile-video-overlay';

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    const params = new URLSearchParams(location.search);
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
