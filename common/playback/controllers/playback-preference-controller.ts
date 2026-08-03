import { CachedLocalStorage } from '@project/common/app/services/cached-local-storage';

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
        this.storage.set(volumeKey, String(volume));
    }

    get theaterMode(): boolean {
        return this.storage.get(theaterModeKey) === 'true';
    }

    set theaterMode(theaterMode: boolean) {
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
        this.storage.set(subtitlePlayerWidthKey, String(width));
    }
}
