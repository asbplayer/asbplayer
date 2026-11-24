import { renderMobileVideoOverlay } from '@/ui/mobile-video-overlay';
import { configureExtensionLogProvider } from '@/services/extension-log-provider';

configureExtensionLogProvider();

const params = new URLSearchParams(location.search);

window.addEventListener('load', () => {
    const root = document.getElementById('root')!;
    const anchor = params.get('anchor');

    const scrollBufferDiv = document.createElement('div');
    const vertical = anchor === 'left' || anchor === 'right';

    // Add div above/below or beside the overlay to support scrolling the overlay out of view
    if (vertical) {
        scrollBufferDiv.className = 'asbplayer-mobile-video-overlay-scroll-buffer-horizontal';
        document.body.classList.add('asbplayer-mobile-video-overlay-inner-container-vertical');
        if (anchor === 'right') {
            document.body.classList.add('asbplayer-mobile-video-overlay-inner-container-vertical-right');
            document.body.prepend(scrollBufferDiv);
            document.body.scrollLeft = document.body.scrollWidth;
        } else {
            document.body.appendChild(scrollBufferDiv);
        }
    } else {
        scrollBufferDiv.className = 'asbplayer-mobile-video-overlay-scroll-buffer';
        if (anchor === 'bottom') {
            root.style.bottom = '0px';
            document.body.prepend(scrollBufferDiv);
        } else {
            root.style.top = '0px';
            document.body.appendChild(scrollBufferDiv);
        }
    }

    void renderMobileVideoOverlay(root);
});
