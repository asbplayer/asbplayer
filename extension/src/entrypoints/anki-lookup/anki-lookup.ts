import FrameBridgeServer from '@/services/frame-bridge-server';
import { fetchLocalization } from '@/services/localization-fetcher';
import { renderAnkiUi } from '@/ui/anki';

void (async () => {
    const lang = new URLSearchParams(location.search).get('lang') ?? document.documentElement.lang;
    const loc = await fetchLocalization(lang);
    document.documentElement.lang = loc.lang;
    const bridge = renderAnkiUi(document.getElementById('root')!, loc.lang, loc.strings, true);
    const listener = new FrameBridgeServer(bridge);
    listener.bind({ useRuntimeMessages: true });
    window.addEventListener('unload', () => listener.unbind());
})();
