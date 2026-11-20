import FrameBridgeServer from '@/services/frame-bridge-server';
import { fetchLocalization } from '@/services/localization-fetcher';
import { renderVideoDataSyncUi } from '@/ui/video-data-sync';

void (async () => {
    const lang = new URLSearchParams(location.search).get('lang') ?? document.documentElement.lang;
    const loc = await fetchLocalization(lang);
    document.documentElement.lang = loc.lang;
    const bridge = renderVideoDataSyncUi(document.getElementById('root')!, loc.lang, loc.strings);
    const listener = new FrameBridgeServer(bridge);
    listener.bind();
    window.addEventListener('unload', () => listener.unbind());
})();
