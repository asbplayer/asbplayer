import { afterEach, describe, expect, it, jest } from '@jest/globals';
import ChromeExtension from '@project/common/app/services/chrome-extension';
import { AppExtensionDictionaryStorage } from '@project/common/app/services/app-extension-dictionary-storage';
import type { DictionaryStatisticsSnapshot } from '@project/common/dictionary-statistics';
import { defaultSettings } from '@project/common/settings';
import type { SubtitleReference, SubtitleSourceStatus } from '@project/common/subtitle-reader/subtitle-stream';

let extension: ChromeExtension;
let unsubscribe = () => {};

afterEach(() => {
    unsubscribe();
    extension.unbind();
    jest.restoreAllMocks();
});

const connect = (version: string) => {
    extension = new ChromeExtension(version);
    return new AppExtensionDictionaryStorage(extension);
};

const receive = (message: object) =>
    window.dispatchEvent(
        new MessageEvent('message', {
            source: window,
            data: { sender: 'asbplayer-extension-to-player', message },
        })
    );

const snapshot = (tracks: { track: number; sourceStatus?: SubtitleSourceStatus }[]) => ({
    mediaId: 'video',
    settings: { dictionaryTracks: defaultSettings.dictionaryTracks },
    anki: { cardsInfo: {}, dueCards: {} },
    snapshots: tracks.map((track) => ({
        ...track,
        progress: { current: 0, total: 0 },
        statusColors: { 0: '#000', 1: '#111', 2: '#222', 3: '#333', 4: '#444', 5: '#555' },
        stats: { dictionary: { tokens: {} }, sentences: {} },
    })),
});

describe('older extension statistics boundary', () => {
    it('adds completed source status to older snapshots before delivering them to consumers', () => {
        const storage = connect('1.23.0');
        const callback = jest.fn<(snapshot?: DictionaryStatisticsSnapshot) => void>();
        unsubscribe = storage.onStatisticsSnapshot(callback);
        const original = snapshot([{ track: 0 }, { track: 2 }]);
        receive({ command: 'dictionary-statistics', mediaId: 'video', snapshot: original });
        expect(callback).toHaveBeenLastCalledWith({
            ...original,
            snapshots: original.snapshots.map((track) => ({ ...track, sourceStatus: 'complete' })),
        });
        expect(original.snapshots[0]).not.toHaveProperty('sourceStatus');

        receive({ command: 'dictionary-statistics', mediaId: 'video', snapshot: undefined });
        expect(callback).toHaveBeenLastCalledWith(undefined);
    });

    it('preserves loading, completed, and failed status from a current extension', () => {
        const storage = connect('1.24.0');
        const callback = jest.fn<(snapshot?: DictionaryStatisticsSnapshot) => void>();
        unsubscribe = storage.onStatisticsSnapshot(callback);
        const current = snapshot([
            { track: 0, sourceStatus: 'loading' },
            { track: 1, sourceStatus: 'complete' },
            { track: 2, sourceStatus: 'failed' },
        ]);
        receive({ command: 'dictionary-statistics', mediaId: 'video', snapshot: current });
        expect(callback).toHaveBeenCalledWith(current);
    });

    it.each(['1.23.0', '1.24.0'])('receives mining requests from extension %s', (version) => {
        const storage = connect(version);
        const callback = jest.fn<(mediaId: string, subtitles: readonly SubtitleReference[]) => void>();
        unsubscribe = storage.onRequestStatisticsMineSentences(callback);
        const references = [{ index: 1, track: 0, source: { loadId: 'source', cueId: 0 } }];
        const payload = version === '1.23.0' ? { indexes: [1] } : { indexes: [1], subtitles: references };
        receive({ command: 'dictionary-request-statistics-mine-sentences', mediaId: 'video', ...payload });
        expect(callback).toHaveBeenCalledWith('video', version === '1.23.0' ? [1] : references);
    });

    it.each(['1.23.0', '1.24.0'])('sends the mining payload understood by extension %s', (version) => {
        connect(version);
        const post = jest.spyOn(window, 'postMessage').mockImplementation(() => {});
        const references = [{ index: 1, track: 0, source: { loadId: 'source', cueId: 0 } }];
        extension.requestStatisticsMineSentences('video', references);
        expect(post).toHaveBeenCalledWith({
            sender: 'asbplayerv2',
            message: {
                command: 'dictionary-request-statistics-mine-sentences',
                mediaId: 'video',
                indexes: [1],
                subtitles: references,
            },
        });
    });
});
