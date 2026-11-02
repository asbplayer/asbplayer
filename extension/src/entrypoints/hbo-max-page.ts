import { extractExtension } from '@/pages/util';
import { inferTracksFromInterceptedMpdViaXMLHTTPRequest } from '@/pages/mpd-util';
import { genericSubtitleDisplayLabel } from '@project/common/util/subtitle-language';

interface HboMaxPlayer {
    seek(timestampMs: number): void;
    _isDestroyed: boolean;
    _rootElement: Element;
    _playbackEngineAdapter: {
        _isEngineReady: boolean;
        _isTimelineReady: boolean;
        _isLive: boolean;
    };
}

export default defineUnlistedScript(() => {
    function isHboMaxPlayer(value: any, video: HTMLMediaElement): value is HboMaxPlayer {
        const adapter = value?._playbackEngineAdapter;
        return (
            typeof value?.seek === 'function' &&
            value._isDestroyed === false &&
            adapter?._isEngineReady === true &&
            adapter._isTimelineReady === true &&
            adapter._isLive === false &&
            value._rootElement instanceof Element &&
            value._rootElement.contains(video)
        );
    }

    function findHboMaxPlayer(video: HTMLMediaElement): HboMaxPlayer | undefined {
        const visitedFibers = new Set<any>();
        let element: Element | null = video;
        for (let depth = 0; element !== null && depth < 20; ++depth, element = element.parentElement) {
            const key = Object.keys(element).find((name) => name.startsWith('__reactFiber'));
            if (key === undefined) continue;
            let fiber = (element as any)[key];
            for (let i = 0; fiber != null && i < 60; ++i, fiber = fiber.return) {
                if (visitedFibers.has(fiber)) break;
                visitedFibers.add(fiber);
                // HBO stores its public player in a useRef hook above the video. Match
                // the player shape rather than a minified component name or hook index.
                let hook = fiber.memoizedState;
                for (let h = 0; hook != null && h < 30; ++h, hook = hook.next) {
                    const candidate = hook.memoizedState?.current;
                    if (isHboMaxPlayer(candidate, video)) return candidate;
                }
            }
        }
        return;
    }

    document.addEventListener('asbplayer-hbo-max-seek', (event) => {
        const timestampMs: unknown = (event as CustomEvent).detail;
        const video = event.composedPath().find((target) => target instanceof HTMLMediaElement);
        if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs) || !(video instanceof HTMLMediaElement)) {
            return;
        }
        try {
            const player = findHboMaxPlayer(video);
            if (player === undefined) return;
            // The observed API takes content milliseconds and passes through
            // onUserInitiatedSeek, preserving HBO's timeline and seek-state handling.
            player.seek(timestampMs);
            event.preventDefault();
        } catch {
            // An uncancelled event falls back to a single video.currentTime write.
        }
    });

    inferTracksFromInterceptedMpdViaXMLHTTPRequest(/https:\/\/.+\.mpd/, (playlist, playlistLabel, metadata) => {
        const language = metadata?.language;
        const label =
            language && playlistLabel.startsWith(`${language} `)
                ? playlistLabel.slice(language.length).trim()
                : playlistLabel;
        const segmentUrls = playlist.segments.map((s) => s.resolvedUri);
        return {
            label: genericSubtitleDisplayLabel(label, language, playlistLabel),
            language,
            url: segmentUrls,
            extension: extractExtension(playlist.resolvedUri, 'vtt'),
        };
    });
});
