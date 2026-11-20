import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// The unrelated SRT parser ships as ESM. The tests below use the real WebVTT parser.
jest.mock('@qgustavor/srt-parser', () => ({ __esModule: true, default: class {} }));

import { SubtitleHtml } from '@project/common';
import type { DisplaySubtitleModel, LoadableSubtitleTrack, SubtitleSourceMessage } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import VideoChannel from '@project/common/app/services/video-channel';
import { useSubtitleTracks } from '@project/common/app/hooks/use-subtitle-tracks';
import {
    SubtitleStream,
    subtitleSourceNames,
    subtitleSourceStatus,
} from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceProducer, SubtitleSourceState } from '@project/common/subtitle-reader/subtitle-stream';
import { MediaSources } from '@project/common/app/services/media-sources';

import {
    TestVideoProtocol,
    track,
    vttText,
    createProducer,
} from '@project/common/app/services/subtitle-tracks-test-utils';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let subtitleOffset = 500;
const getSubtitleOffset = () => subtitleOffset;

describe('useSubtitleTracks React integration', () => {
    let root: Root;
    let container: HTMLDivElement;
    let protocol: TestVideoProtocol;
    let channel: VideoChannel;
    let reader: SubtitleReader;
    let annotate: () => void;
    const onLoaded = jest.fn<(subtitleSourceFiles: File[]) => void>();
    const onError = jest.fn<(error: unknown) => void>();
    const shouldRestoreSubtitles = jest.fn<(subtitleCount: number) => Promise<boolean>>();

    function Player({
        tracks,
        activeChannel = channel,
        progressive = false,
        ownership = 'local',
        producer,
        onSourcesChanged,
    }: {
        tracks: LoadableSubtitleTrack<FileWithId>[] | undefined;
        activeChannel?: VideoChannel;
        progressive?: boolean;
        ownership?: 'local' | 'remote';
        producer?: SubtitleSourceProducer;
        onSourcesChanged?: (sources: readonly SubtitleSourceState[]) => void;
    }) {
        const [subtitles, setSubtitles] = useState<DisplaySubtitleModel[] | undefined>();
        const onInitialized = () =>
            onLoaded(tracks?.flatMap(({ fileParts }) => fileParts.map(({ file }) => file)) ?? []);
        const result = useSubtitleTracks({
            source:
                ownership === 'remote'
                    ? {
                          kind: 'remote',
                          supportsProgressiveSubtitles: progressive,
                          onOffset: (offset) => {
                              subtitleOffset = offset;
                          },
                          onSourcesChanged,
                      }
                    : producer
                      ? { kind: 'producer', producer, supportsProgressiveSubtitles: progressive, onInitialized }
                      : {
                            kind: 'local',
                            tracks,
                            reader,
                            onInitialized,
                        },
            subtitles,
            channel: activeChannel,
            getSubtitleOffset,
            shouldRestoreSubtitles,
            onSubtitles: setSubtitles,
            onError,
        });
        annotate = () =>
            setSubtitles((previous) =>
                previous?.map((cue) => ({
                    ...cue,
                    originalText: cue.text,
                    text: `<b>${cue.text}</b>`,
                    tokenization: { tokens: [] },
                }))
            );
        return (
            <div data-loading={result.loadingSubtitles}>
                {subtitles?.map((subtitle) => (
                    <span key={subtitle.index} data-start={subtitle.start}>
                        {subtitle.text}
                    </span>
                ))}
            </div>
        );
    }

    const render = async (tracks: LoadableSubtitleTrack<FileWithId>[] | undefined) => {
        await act(async () => root.render(<Player tracks={tracks} />));
    };

    beforeEach(() => {
        subtitleOffset = 500;
        onLoaded.mockClear();
        onError.mockClear();
        shouldRestoreSubtitles.mockReset().mockResolvedValue(true);
        protocol = new TestVideoProtocol();
        channel = new VideoChannel(protocol);
        reader = new SubtitleReader({
            regexFilter: '',
            regexFilterTextReplacement: '',
            subtitleHtml: SubtitleHtml.render,
            convertNetflixRuby: false,
            pgsParserWorkerFactory: () => Promise.reject(new Error('PGS is not used in this test')),
        });
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it.each([true, false])('clears rendered and video subtitles when ready at clear is %s', async (readyAtClear) => {
        if (readyAtClear) protocol.ready();
        await render([track('Loaded')]);
        expect(container.textContent).toBe('Loaded');
        if (readyAtClear) {
            expect(protocol.subtitleMessages.at(-1)?.value).toEqual([
                expect.objectContaining({ text: 'Loaded', start: 1500, originalStart: 1000 }),
            ]);
        }

        await render([]);
        if (!readyAtClear) await act(async () => protocol.ready());

        expect(container.textContent).toBe('');
        expect(container.firstElementChild?.getAttribute('data-loading')).toBe('false');
        expect(protocol.subtitleMessages.at(-1)).toEqual({ command: 'subtitles', value: [], name: null, names: [] });
        expect(protocol.subtitleMessages.some(({ names }) => names.includes('Loaded.vtt'))).toBe(readyAtClear);
        expect(onLoaded).toHaveBeenLastCalledWith([]);
        expect(onError).not.toHaveBeenCalled();
    });

    it('restarts safely after React replays effect setup and cleanup', async () => {
        protocol.ready();
        const tracks = [track('Loaded')];
        await act(async () =>
            root.render(
                <React.StrictMode>
                    <Player tracks={tracks} />
                </React.StrictMode>
            )
        );
        expect(container.textContent).toBe('Loaded');
        expect(protocol.subtitleMessages).toHaveLength(1);
        expect(onLoaded).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    });

    it.each(['remote', 'channel', 'unmount'] as const)(
        'discards a delayed recovery after a %s change',
        async (change) => {
            const tracks = [track('Loaded')];
            protocol.ready();
            await render(tracks);
            let finish!: (restore: boolean) => void;
            shouldRestoreSubtitles.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
            await act(async () => protocol.ready());
            const nextProtocol = new TestVideoProtocol();
            const nextChannel = new VideoChannel(nextProtocol);
            if (change === 'remote') {
                await act(async () => root.render(<Player tracks={undefined} ownership="remote" />));
            } else if (change === 'channel') {
                nextProtocol.ready();
                await act(async () => root.render(<Player tracks={tracks} activeChannel={nextChannel} />));
            } else {
                await act(async () => root.render(null));
            }
            const sent = protocol.subtitleMessages.length;
            const nextSent = nextProtocol.subtitleMessages.length;
            await act(async () => finish(true));
            expect(protocol.subtitleMessages).toHaveLength(sent);
            expect(nextProtocol.subtitleMessages).toHaveLength(nextSent);
            nextChannel.close();
        }
    );

    it('keeps loaded annotations when the source configuration is recreated', async () => {
        const tracks = [track('Loaded')];
        await render(tracks);
        await act(async () => annotate());
        await render(tracks);
        expect(container.textContent).toBe('<b>Loaded</b>');
        expect(onLoaded).toHaveBeenCalledTimes(1);
    });

    it('sends the loaded subtitles to a replacement channel without reloading files', async () => {
        const tracks = [track('Loaded')];
        protocol.ready();
        await render(tracks);
        const nextProtocol = new TestVideoProtocol();
        const nextChannel = new VideoChannel(nextProtocol);

        await act(async () => root.render(<Player tracks={tracks} activeChannel={nextChannel} />));
        await act(async () => nextProtocol.ready());

        expect(nextProtocol.subtitleMessages.at(-1)).toMatchObject({
            names: ['Loaded.vtt'],
            value: [expect.objectContaining({ text: 'Loaded' })],
        });
        expect(onLoaded).toHaveBeenCalledTimes(1);
    });
    it('requests a remote snapshot on reconnection without echoing it or losing annotations', async () => {
        const remote = new SubtitleStream();
        remote.update({ type: 'start', track: 0, loadId: 'remote', name: 'remote.ass' });
        remote.update({
            type: 'cues',
            track: 0,
            loadId: 'remote',
            cues: [{ cueId: 0, start: 1000, end: 2000, text: 'First' }],
        });
        protocol.source = remote.sourceSnapshot();
        protocol.ready();
        await act(async () => root.render(<Player tracks={undefined} ownership="remote" progressive />));
        await act(async () => annotate());

        remote.update({
            type: 'cues',
            track: 0,
            loadId: 'remote',
            cues: [{ cueId: 1, start: 3000, end: 4000, text: 'Second' }],
        });
        const nextProtocol = new TestVideoProtocol();
        nextProtocol.source = remote.sourceSnapshot();
        nextProtocol.offset = -125;
        const nextChannel = new VideoChannel(nextProtocol);
        await act(async () =>
            root.render(<Player tracks={undefined} ownership="remote" activeChannel={nextChannel} progressive />)
        );
        await act(async () => nextProtocol.ready());

        expect(container.textContent).toBe('<b>First</b>Second');
        expect(Array.from(container.querySelectorAll('span'), (span) => span.getAttribute('data-start'))).toEqual([
            '875',
            '2875',
        ]);
        expect(nextProtocol.sent.map((message) => message.command)).toEqual(['requestSubtitleSource']);
    });

    it('fills remote media-source names from the channel without restarting or echoing the source', async () => {
        function App() {
            const [sources, setSources] = useState(
                () => new MediaSources({ kind: 'remote', names: [], status: 'loading' })
            );
            return (
                <>
                    <header data-downloads={sources.canDownloadSubtitles}>{sources.subtitleFileNames.join('|')}</header>
                    <Player
                        tracks={sources.subtitleTracks}
                        ownership="remote"
                        progressive
                        onSourcesChanged={(states) => {
                            const names = subtitleSourceNames(states);
                            const status = subtitleSourceStatus(states);
                            setSources((previous) =>
                                previous.subtitleSource.kind === 'remote' &&
                                previous.subtitleSource.status === status &&
                                names.length === previous.subtitleFileNames.length &&
                                names.every((name, track) => name === previous.subtitleFileNames[track])
                                    ? previous
                                    : new MediaSources({ kind: 'remote', names, status })
                            );
                        }}
                    />
                </>
            );
        }
        protocol.source = {
            tracks: [{ track: 2, loadId: 'remote', name: 'remote.ass', status: 'loading', cues: [] }],
        };
        protocol.ready();
        await act(async () => root.render(<App />));
        expect(container.querySelector('header')?.textContent).toBe('||remote.ass');
        expect(container.querySelector('header')?.getAttribute('data-downloads')).toBe('false');
        const receive = (update: SubtitleSourceMessage['update']) =>
            act(async () => protocol.onMessage?.({ data: { command: 'subtitleSource', update } }));
        await receive({
            type: 'cues',
            track: 2,
            loadId: 'remote',
            cues: [{ cueId: 0, start: 1000, end: 2000, text: 'First' }],
        });
        await act(async () => annotate());
        await receive({ type: 'start', track: 0, loadId: 'companion', name: 'companion.vtt' });
        expect(container.querySelector('header')?.textContent).toBe('companion.vtt||remote.ass');
        expect(container.querySelector('span')?.textContent).toBe('<b>First</b>');
        await receive({ type: 'complete', track: 0, loadId: 'companion' });
        expect(container.querySelector('header')?.getAttribute('data-downloads')).toBe('false');
        await receive({ type: 'complete', track: 2, loadId: 'remote' });
        expect(container.querySelector('header')?.getAttribute('data-downloads')).toBe('true');
        expect(container.querySelector('span')?.textContent).toBe('<b>First</b>');
        await receive({ type: 'snapshot', tracks: [], offset: 0 });
        expect(container.querySelector('header')?.textContent).toBe('');
        expect(container.querySelector('span')).toBeNull();
        expect(container.querySelector('header')?.getAttribute('data-downloads')).toBe('false');
        expect(protocol.sent.map((message) => message.command)).toEqual(['requestSubtitleSource']);
        expect(onLoaded).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    it('replays a producer snapshot and annotations on reconnection without restarting production', async () => {
        const source = createProducer();
        await act(async () => root.render(<Player tracks={undefined} producer={source.producer} progressive />));
        await act(async () => source.append('First'));
        await act(async () => annotate());
        const nextProtocol = new TestVideoProtocol();
        const nextChannel = new VideoChannel(nextProtocol);
        await act(async () =>
            root.render(
                <Player tracks={undefined} producer={source.producer} activeChannel={nextChannel} progressive />
            )
        );
        await act(async () => nextProtocol.ready());
        expect(onLoaded).toHaveBeenCalledTimes(1);
        expect(source.signal.aborted).toBe(false);
        expect(nextProtocol.sent).toMatchObject([
            {
                command: 'subtitleSource',
                update: {
                    type: 'snapshot',
                    tracks: [{ status: 'loading', cues: [{ cueId: 0, text: 'First' }] }],
                },
            },
            { command: 'subtitlesUpdated', subtitles: [{ text: '<b>First</b>' }] },
        ]);
        await act(async () => source.append('Second', 1));
        expect(container.textContent).toBe('<b>First</b>Second');
        expect(nextProtocol.sent.at(-1)).toMatchObject({
            command: 'subtitleSource',
            update: { type: 'cues', cues: [{ cueId: 1, text: 'Second' }] },
        });
    });

    it('keeps production running when file inputs, reader settings, and transport capabilities change', async () => {
        const source = createProducer();
        await act(async () => root.render(<Player tracks={undefined} producer={source.producer} progressive />));
        const signal = source.signal;
        await act(async () => source.append('First'));
        reader = new SubtitleReader({
            regexFilter: 'speaker: ',
            regexFilterTextReplacement: '',
            subtitleHtml: SubtitleHtml.render,
            convertNetflixRuby: false,
            pgsParserWorkerFactory: () => Promise.reject(new Error('PGS is not used in this test')),
        });
        await act(async () => root.render(<Player tracks={[track('Ignored')]} producer={source.producer} />));
        expect(signal.aborted).toBe(false);
        expect(source.signal).toBe(signal);
        expect(onLoaded).toHaveBeenCalledTimes(1);
        await act(async () => source.finish());
        expect(container.textContent).toBe('First');
        expect(onError).not.toHaveBeenCalled();
    });

    it('cancels production and removes channel subscriptions on unmount', async () => {
        const source = createProducer();
        protocol.ready();
        await act(async () => root.render(<Player tracks={undefined} producer={source.producer} progressive />));
        await act(async () => source.append('First'));
        await act(async () => root.render(null));
        expect(source.signal.aborted).toBe(true);
        const sent = protocol.sent.length;
        await act(async () => {
            source.append('Obsolete', 1);
            source.fail(new Error('Obsolete failure'));
            protocol.ready();
        });
        expect(protocol.sent).toHaveLength(sent);
        expect(onError).not.toHaveBeenCalled();
    });

    it('switches a pending file load to a remote source without replacing the channel', async () => {
        let finish!: (text: string) => void;
        const pending = track(
            'Old',
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                })
        );
        protocol.ready();
        await act(async () => root.render(<Player tracks={[pending]} progressive />));
        const source = new SubtitleStream();
        source.update({ type: 'start', track: 0, loadId: 'remote', name: 'remote.ass' });
        source.update({
            type: 'cues',
            track: 0,
            loadId: 'remote',
            cues: [{ cueId: 0, start: 1000, end: 2000, text: 'Remote' }],
        });
        protocol.source = source.sourceSnapshot();
        await act(async () => root.render(<Player tracks={undefined} ownership="remote" progressive />));
        expect(container.textContent).toBe('Remote');
        await act(async () => finish(vttText('Old')));
        expect(container.textContent).toBe('Remote');
        expect(onLoaded).not.toHaveBeenCalled();
        expect(protocol.sent.filter((message) => message.command === 'requestSubtitleSource')).toHaveLength(1);
    });
});
