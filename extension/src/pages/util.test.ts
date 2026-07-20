import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { extractExtension, inferTracks, poll, trackFromDef, trackId } from '@project/extension/src/pages/util';

function track(label: string, language: string, url: string | string[]) {
    return { label, language, url, extension: 'vtt' };
}

const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};

describe('extractExtension', () => {
    it('returns the fallback when there is no extension', () => {
        expect(extractExtension('/path/to/subtitles', 'vtt')).toBe('vtt');
    });

    it('extracts a plain extension for 1 item', () => {
        expect(extractExtension('https://example.com/path/to/subtitles.srt', 'vtt')).toBe('srt');
    });

    it('extracts the extension for 2 common URL variants with multiple dots and query strings', () => {
        expect(extractExtension('https://example.com/path.to/subtitles.ass?token=abc', 'vtt')).toBe('ass');
        expect(extractExtension('https://example.com/path/file.vtt?lang=ja', 'srt')).toBe('vtt');
    });
});

describe('poll', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('resolves immediately and stops polling after the condition passes', async () => {
        let calls = 0;

        const promise = poll(() => {
            calls++;
            return true;
        }, 5000);
        await expect(promise).resolves.toBe(true);
        await jest.advanceTimersByTimeAsync(10000);

        expect(calls).toBe(1);
    });

    it('resolves after the condition passes on the second poll', async () => {
        let calls = 0;
        const promise = poll(() => ++calls >= 2, 2500);

        await jest.advanceTimersByTimeAsync(1000);

        await expect(promise).resolves.toBe(true);
        expect(calls).toBe(2);
    });

    it('returns false when the timeout expires', async () => {
        let calls = 0;
        const promise = poll(() => {
            calls++;
            return false;
        }, 1500);

        await jest.advanceTimersByTimeAsync(2000);

        await expect(promise).resolves.toBe(false);
        expect(calls).toBe(3);
    });
});

describe('track helpers', () => {
    it('builds deterministic ids from track definitions', () => {
        expect(trackId(track('English', 'en', 'https://example.com/en.vtt'))).toBe(
            'en:English:https://example.com/en.vtt'
        );
        expect(trackId(track('English', 'en', ['https://example.com/en-1.vtt', 'https://example.com/en-2.vtt']))).toBe(
            'en:English:https://example.com/en-1.vtt,https://example.com/en-2.vtt'
        );
    });

    it('adds the computed id when building a track from a definition', () => {
        expect(trackFromDef(track('Japanese', 'ja', 'https://example.com/ja.vtt'))).toEqual({
            id: 'ja:Japanese:https://example.com/ja.vtt',
            label: 'Japanese',
            language: 'ja',
            url: 'https://example.com/ja.vtt',
            extension: 'vtt',
        });
    });
});

describe('inferTracks', () => {
    const originalParse = JSON.parse;
    const originalPath = window.location.pathname;
    let requestHandler: ((event: Event) => Promise<void> | void) | undefined;
    let dispatchedDetails: any[];

    beforeEach(() => {
        jest.useFakeTimers();
        history.replaceState({}, '', '/first');
        requestHandler = undefined;
        dispatchedDetails = [];
        jest.spyOn(document, 'addEventListener').mockImplementation(
            (type: string, listener: EventListenerOrEventListenerObject) => {
                if (type === 'asbplayer-get-synced-data') {
                    requestHandler =
                        typeof listener === 'function' ? listener : async (event: Event) => listener.handleEvent(event);
                }
            }
        );
        jest.spyOn(document, 'dispatchEvent').mockImplementation((event: Event) => {
            dispatchedDetails.push((event as CustomEvent).detail);
            return true;
        });
    });

    afterEach(() => {
        JSON.parse = originalParse;
        history.replaceState({}, '', originalPath || '/');
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('dedupes requested tracks and emits basename before the final synced payload when not waiting for basename', async () => {
        inferTracks(
            {
                onRequest: async (addTrack, setBasename) => {
                    setBasename('Episode 1');
                    addTrack(track('English', 'en', 'https://example.com/en.vtt'));
                    addTrack(track('English', 'en', 'https://example.com/en.vtt'));
                    addTrack(track('Japanese', 'ja', 'https://example.com/ja.vtt'));
                },
                waitForBasename: false,
            },
            1000
        );

        await jest.runOnlyPendingTimersAsync();
        await requestHandler?.(new Event('asbplayer-get-synced-data'));

        expect(dispatchedDetails).toEqual([
            { error: '', basename: 'Episode 1', subtitles: undefined },
            {
                error: '',
                basename: 'Episode 1',
                subtitles: [
                    {
                        id: 'en:English:https://example.com/en.vtt',
                        label: 'English',
                        language: 'en',
                        url: 'https://example.com/en.vtt',
                        extension: 'vtt',
                    },
                    {
                        id: 'ja:Japanese:https://example.com/ja.vtt',
                        label: 'Japanese',
                        language: 'ja',
                        url: 'https://example.com/ja.vtt',
                        extension: 'vtt',
                    },
                ],
            },
        ]);
    });

    it('waits for the basename to arrive through JSON.parse when configured to do so', async () => {
        inferTracks(
            {
                onJson: (value, _addTrack, setBasename) => {
                    if (value.basename) {
                        setBasename(value.basename);
                    }
                },
                onRequest: async (addTrack) => {
                    addTrack(track('English', 'en', 'https://example.com/en.vtt'));
                },
                waitForBasename: true,
            },
            2000
        );

        await jest.runOnlyPendingTimersAsync();
        const requestPromise = requestHandler?.(new Event('asbplayer-get-synced-data'));
        JSON.parse('{"basename":"Episode 2"}');
        await jest.advanceTimersByTimeAsync(1000);
        await requestPromise;

        expect(dispatchedDetails).toEqual([
            {
                error: '',
                basename: 'Episode 2',
                subtitles: [
                    {
                        id: 'en:English:https://example.com/en.vtt',
                        label: 'English',
                        language: 'en',
                        url: 'https://example.com/en.vtt',
                        extension: 'vtt',
                    },
                ],
            },
        ]);
    });

    it('emits additional synced data when JSON.parse discovers a new track after the initial request', async () => {
        inferTracks(
            {
                onJson: (value, addTrack, setBasename) => {
                    if (value.basename) {
                        setBasename(value.basename);
                    }
                    if (value.track) {
                        addTrack(value.track);
                    }
                },
                onRequest: async (addTrack, setBasename) => {
                    setBasename('Episode 3');
                    addTrack(track('English', 'en', 'https://example.com/en.vtt'));
                },
                waitForBasename: false,
            },
            1000
        );

        await jest.runOnlyPendingTimersAsync();
        await requestHandler?.(new Event('asbplayer-get-synced-data'));
        JSON.parse(
            '{"track":{"label":"Japanese","language":"ja","url":"https://example.com/ja.vtt","extension":"vtt"}}'
        );
        const dispatchCountAfterNewTrack = dispatchedDetails.length;
        JSON.parse(
            '{"track":{"label":"Japanese","language":"ja","url":"https://example.com/ja.vtt","extension":"vtt"}}'
        );

        expect(dispatchedDetails[dispatchCountAfterNewTrack - 1]).toEqual({
            error: '',
            basename: 'Episode 3',
            subtitles: [
                {
                    id: 'en:English:https://example.com/en.vtt',
                    label: 'English',
                    language: 'en',
                    url: 'https://example.com/en.vtt',
                    extension: 'vtt',
                },
                {
                    id: 'ja:Japanese:https://example.com/ja.vtt',
                    label: 'Japanese',
                    language: 'ja',
                    url: 'https://example.com/ja.vtt',
                    extension: 'vtt',
                },
            ],
        });
        expect(dispatchedDetails).toHaveLength(dispatchCountAfterNewTrack);
    });

    it('times out to an empty subtitle list when no tracks are discovered', async () => {
        inferTracks({ waitForBasename: false }, 1000);

        await jest.runOnlyPendingTimersAsync();
        const requestPromise = requestHandler?.(new Event('asbplayer-get-synced-data'));
        await jest.advanceTimersByTimeAsync(1000);
        await requestPromise;

        expect(dispatchedDetails).toEqual([{ error: '', basename: '', subtitles: [] }]);
    });

    it('garbage collects inferred tracks for paths that are no longer current', async () => {
        let requestCount = 0;
        inferTracks(
            {
                onRequest: async (addTrack) => {
                    requestCount++;
                    if (requestCount === 1) {
                        addTrack(track('English', 'en', 'https://example.com/en.vtt'));
                    } else if (requestCount === 2) {
                        addTrack(track('Japanese', 'ja', 'https://example.com/ja.vtt'));
                    }
                },
                waitForBasename: false,
            },
            1000
        );

        await jest.runOnlyPendingTimersAsync();
        await requestHandler?.(new Event('asbplayer-get-synced-data'));
        expect(
            dispatchedDetails[dispatchedDetails.length - 1].subtitles.map((subtitle: any) => subtitle.language)
        ).toEqual(['en']);

        history.replaceState({}, '', '/second');
        await requestHandler?.(new Event('asbplayer-get-synced-data'));
        expect(
            dispatchedDetails[dispatchedDetails.length - 1].subtitles.map((subtitle: any) => subtitle.language)
        ).toEqual(['ja']);

        history.replaceState({}, '', '/first');
        const requestPromise = requestHandler?.(new Event('asbplayer-get-synced-data'));
        await jest.advanceTimersByTimeAsync(1000);
        await requestPromise;

        expect(dispatchedDetails[dispatchedDetails.length - 1]).toEqual({ error: '', basename: '', subtitles: [] });
    });

    it('files tracks from a late async request under the request path after navigation', async () => {
        const request = deferred<void>();
        inferTracks(
            {
                onRequest: async (addTrack) => {
                    await request.promise;
                    addTrack(track('English', 'en', 'https://example.com/en.vtt'));
                },
                waitForBasename: false,
            },
            1000
        );

        await jest.runOnlyPendingTimersAsync();
        void requestHandler?.(new Event('asbplayer-get-synced-data'));
        history.replaceState({}, '', '/second');

        request.resolve();
        await Promise.resolve();
        history.replaceState({}, '', '/first');
        await jest.advanceTimersByTimeAsync(1000);

        expect(dispatchedDetails[dispatchedDetails.length - 1]).toEqual({
            error: '',
            basename: '',
            subtitles: [
                {
                    id: 'en:English:https://example.com/en.vtt',
                    label: 'English',
                    language: 'en',
                    url: 'https://example.com/en.vtt',
                    extension: 'vtt',
                },
            ],
        });
    });
});
