import { CachedLocalStorage } from '@project/common/app/services/cached-local-storage';
import { asbTrace } from '@project/common/util/log';

const volumeKey = 'volume';
const theaterModeKey = 'theaterMode';
const displaySubtitlesKey = 'displaySubtitles';
const hideSubtitleListKey = 'hideSubtitleList';
const subtitlePlayerWidthKey = 'subtitlePlayerWidth';
const defaultVolume = 100;

/** Owns playback preferences that are local to the playback UI. */
export default class PlaybackPreferenceController {
    private readonly storage = new CachedLocalStorage();

    get hideSubtitleList(): boolean {
        return this.storage.get(hideSubtitleListKey) === 'true';
    }

    set hideSubtitleList(value: boolean) {
        asbTrace('playback/preferences', 'Changed subtitle list visibility preference', { value });
        this.storage.set(hideSubtitleListKey, String(value));
    }

    get volume(): number {
        const value = this.storage.get(volumeKey);

        if (value === null) {
            return defaultVolume;
        }

        return Number(value);
    }

    set volume(volume: number) {
        asbTrace('playback/preferences', 'Changed playback volume preference', { volume });
        this.storage.set(volumeKey, String(volume));
    }

    get theaterMode(): boolean {
        return this.storage.get(theaterModeKey) === 'true';
    }

    set theaterMode(theaterMode: boolean) {
        asbTrace('playback/preferences', 'Changed theater mode preference', { theaterMode });
        this.storage.set(theaterModeKey, String(theaterMode));
    }

    get displaySubtitles(): boolean {
        const value = this.storage.get(displaySubtitlesKey);

        if (value === null) {
            return true;
        }

        return value === 'true';
    }

    set displaySubtitles(displaySubtitles: boolean) {
        asbTrace('playback/preferences', 'Changed subtitle display preference', { displaySubtitles });
        this.storage.set(displaySubtitlesKey, String(displaySubtitles));
    }

    get subtitlePlayerWidth(): number | undefined {
        const value = this.storage.get(subtitlePlayerWidthKey);

        if (value === null) {
            return undefined;
        }

        return Number(value);
    }

    set subtitlePlayerWidth(width: number) {
        asbTrace('playback/preferences', 'Changed subtitle player width preference', { width });
        this.storage.set(subtitlePlayerWidthKey, String(width));
    }
}
