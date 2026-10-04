import { inferTracksFromInterceptedMpd } from '@/pages/mpd-util';
import { extractExtension } from '@/pages/util';

export default defineUnlistedScript(() => {
    inferTracksFromInterceptedMpd(/https:\/\/(.+\.)?.+\.mpd/, (playlist, language) => {
        const name = playlist.attributes?.NAME;
        return {
            label: name === undefined ? language : `${language} - ${name}`,
            language,
            url: playlist.resolvedUri,
            extension: extractExtension(playlist.resolvedUri, 'vtt'),
        };
    });
});
