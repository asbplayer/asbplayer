import { SubtitleAlignment } from '@project/common/settings';
import { CachedLocalStorage } from './cached-local-storage';
import ChromeExtension from './chrome-extension';

const volumeKey = 'volume';
const theaterModeKey = 'theaterMode';
const offsetKey = 'offset';
const displaySubtitlesKey = 'displaySubtitles';
const hideSubtitleListKey = 'hideSubtitleList';
const subtitlePlayerWidthKey = 'subtitlePlayerWidth';
const defaultVolume = 100;

interface PlaybackPrefSettings {
    rememberSubtitleOffset: boolean;
    lastSubtitleOffset: number;
    subtitleAlignment: SubtitleAlignment;
    subtitlePositionOffset: number;
    topSubtitlePositionOffset: number;
}

export default class PlaybackPreferences {
    private readonly _settings: PlaybackPrefSettings;
    private readonly _storage = new CachedLocalStorage();
    private readonly _extension: ChromeExtension;

    constructor(settings: PlaybackPrefSettings, extension: ChromeExtension) {
        this._settings = settings;
        this._extension = extension;
    }

    get hideSubtitleList() {
        return this._storage.get(hideSubtitleListKey) === 'true';
    }

    set hideSubtitleList(value: boolean) {
        this._storage.set(hideSubtitleListKey, String(value));
    }

    get volume() {
        const value = this._storage.get(volumeKey);

        if (value === null) {
            return defaultVolume;
        }

        return Number(value);
    }

    set volume(volume) {
        this._storage.set(volumeKey, String(volume));
    }

    get theaterMode() {
        return this._storage.get(theaterModeKey) === 'true' || false;
    }

    set theaterMode(theaterMode) {
        this._storage.set(theaterModeKey, String(theaterMode));
    }

    get offset(): number {
        if (!this._settings.rememberSubtitleOffset) {
            return 0;
        }

        if (this._extension.supportsAppIntegration) {
            return this._settings.lastSubtitleOffset;
        }

        const value = this._storage.get(offsetKey);

        if (value === null) {
            return 0;
        }

        return Number(value);
    }

    set offset(offset: number) {
        if (this._extension.supportsAppIntegration) {
            this._extension.setSettings({ lastSubtitleOffset: offset });
        } else {
            this._storage.set(offsetKey, String(offset));
        }
    }

    get displaySubtitles() {
        const value = this._storage.get(displaySubtitlesKey);

        if (value === null) {
            return true;
        }

        return value === 'true';
    }

    set displaySubtitles(displaySubtitles: boolean) {
        this._storage.set(displaySubtitlesKey, String(displaySubtitles));
    }

    get subtitlePlayerWidth(): number | undefined {
        const value = this._storage.get(subtitlePlayerWidthKey);

        if (value === null) {
            return undefined;
        }

        return Number(value);
    }

    set subtitlePlayerWidth(width: number) {
        this._storage.set(subtitlePlayerWidthKey, String(width));
    }
}
