import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// The unrelated SRT parser ships as ESM. The tests below use the real WebVTT parser.
jest.mock('@qgustavor/srt-parser', () => ({ __esModule: true, default: class {} }));

import { SubtitleHtml } from '@project/common';
import type {
    DisplaySubtitleModel,
    LoadableSubtitleTrack,
    Message,
    ReadyFromVideoMessage,
    SubtitlesToVideoMessage,
} from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import VideoChannel from '@project/common/app/services/video-channel';
import type { VideoProtocol, VideoProtocolMessage } from '@project/common/app/services/video-protocol';
import { useSubtitleTracks } from '@project/common/app/hooks/use-subtitle-tracks';
import { MediaSources } from '@project/common/app/services/media-sources';
import { SubtitleStream, subtitleSourceStatus } from '@project/common/subtitle-reader/subtitle-stream';
import type {
    SubtitleSourceProducer,
    SubtitleSourceSnapshot,
    SubtitleSourceUpdate,
} from '@project/common/subtitle-reader/subtitle-stream';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class TestVideoProtocol implements VideoProtocol {
    readonly sent: Message[] = [];
    source?: SubtitleSourceSnapshot;
    offset = 500;
    onMessage?: (message: VideoProtocolMessage) => void;

    postMessage(message: Message) {
        this.sent.push(message);
        if (message.command === 'requestSubtitleSource' && this.source) {
            this.onMessage?.({
                data: { command: 'subtitleSource', update: { type: 'snapshot', ...this.source, offset: this.offset } },
            });
        }
    }

    close() {}

    ready() {
        const message: ReadyFromVideoMessage = {
            command: 'ready',
            paused: true,
            currentTime: 0,
            duration: 60,
            playbackRate: 1,
        };
        this.onMessage?.({ data: message });
    }

    get subtitleMessages() {
        return this.sent.filter((message) => message.command === 'subtitles') as SubtitlesToVideoMessage[];
    }
}

const vttText = (text: string) => `WEBVTT\n\n00:01.000 --> 00:02.000\n${text}\n\n`;
const track = (text: string, readText = async () => vttText(text)): LoadableSubtitleTrack<FileWithId> => ({
    fileParts: [{ id: text, file: { name: `${text}.vtt`, text: readText } as File }],
});
let subtitleOffset = 500;
const getSubtitleOffset = () => subtitleOffset;

function createProducer(loadId = 'producer') {
    let update!: (update: SubtitleSourceUpdate) => void;
    let signal!: AbortSignal;
    let finish!: () => void;
    let fail!: (error: Error) => void;
    const producer: SubtitleSourceProducer = (publish, abortSignal) => {
        update = publish;
        signal = abortSignal;
        return new Promise<void>((resolve, reject) => {
            finish = () => {
                update({ type: 'complete', track: 0, loadId });
                resolve();
            };
            fail = reject;
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
            update({
                type: 'snapshot',
                tracks: [{ track: 0, loadId, name: `${loadId}.srt`, status: 'loading', cues: [] }],
            });
        });
    };
    return {
        producer,
        append: (text: string, cueId = 0) =>
            update({
                type: 'cues',
                track: 0,
                loadId,
                cues: [{ cueId, start: cueId * 2000 + 1000, end: cueId * 2000 + 2000, text }],
            }),
        finish: () => finish(),
        fail: (error: Error) => fail(error),
        get signal() {
            return signal;
        },
    };
}

describe('useSubtitleTracks source transitions', () => {
    let root: Root;
    let container: HTMLDivElement;
    let protocol: TestVideoProtocol;
    let channel: VideoChannel;
    let reader: SubtitleReader;
    let annotate: () => void;
    const onLoaded = jest.fn<(subtitleSourceFiles: File[]) => void>();
    const onError = jest.fn<(error: unknown) => void>();
    const onStarted = jest.fn<() => void>();

    function Player({
        tracks,
        activeChannel = channel,
        initialSubtitles,
        progressive = false,
        ownership = 'local',
        producer,
    }: {
        tracks: LoadableSubtitleTrack<FileWithId>[] | undefined;
        activeChannel?: VideoChannel;
        initialSubtitles?: DisplaySubtitleModel[];
        progressive?: boolean;
        ownership?: 'local' | 'remote';
        producer?: SubtitleSourceProducer;
    }) {
        const [subtitles, setSubtitles] = useState<DisplaySubtitleModel[] | undefined>(initialSubtitles);
        const result = useSubtitleTracks({
            source:
                ownership === 'remote'
                    ? {
                          kind: 'remote',
                          supportsProgressiveSubtitles: progressive,
                          onOffset: (offset) => {
                              subtitleOffset = offset;
                          },
                      }
                    : producer
                      ? { kind: 'producer', producer, supportsProgressiveSubtitles: progressive, onStarted }
                      : { kind: 'local', tracks, reader, onLoaded },
            subtitles,
            channel: activeChannel,
            getSubtitleOffset,
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
            <div data-loading={result.loadingSubtitles} data-status={subtitleSourceStatus(result.sourceStates)}>
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
        onStarted.mockClear();
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

    it('keeps annotations, offsets, and loaded cues when the audio selection changes', async () => {
        const first = track('First');
        const second = track('Second');
        const sources = MediaSources.fromFiles([
            ...first.fileParts.map((part) => ({ ...part, track: 0 })),
            ...second.fileParts.map((part) => ({ ...part, track: 0 })),
        ]);
        protocol.ready();
        await render(sources.subtitleTracks);
        await act(async () => annotate());
        const messages = protocol.sent.length;
        await render(sources.withAudioTrackIndex(1).subtitleTracks);
        expect(container.textContent).toBe('<b>First</b><b>Second</b>');
        expect([...container.querySelectorAll('span')].map((cue) => cue.dataset.start)).toEqual(['1500', '1500']);
        expect(protocol.sent).toHaveLength(messages);
        expect(onLoaded).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
    });

    it('exposes failed file loads so an unchanged confirmation can retry them', async () => {
        let fail = true;
        const selected = track('Retry', async () => {
            if (fail) throw new Error('Read failed');
            return vttText('Recovered');
        });
        await render([selected]);
        expect(container.firstElementChild?.getAttribute('data-status')).toBe('failed');
        expect(container.textContent).toBe('');
        expect(onError).toHaveBeenCalledTimes(1);
        fail = false;
        await render([selected]);
        expect(container.firstElementChild?.getAttribute('data-status')).toBe('complete');
        expect(container.textContent).toBe('Recovered');
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

    it('leaves externally owned subtitles intact when no source tracks are supplied', async () => {
        const externalSubtitle: DisplaySubtitleModel = {
            text: 'External',
            start: 0,
            end: 1000,
            originalStart: 0,
            originalEnd: 1000,
            displayTime: '0:00',
            displayEndTime: '0:01',
            track: 0,
            index: 0,
        };
        protocol.ready();
        await act(async () => root.render(<Player tracks={undefined} initialSubtitles={[externalSubtitle]} />));

        expect(container.textContent).toBe('External');
        expect(protocol.subtitleMessages).toEqual([]);
        expect(onLoaded).not.toHaveBeenCalled();
    });

    it.each(['resolve', 'reject'] as const)('ignores an old parse that %ss after a clear', async (completion) => {
        let finishRead = () => {};
        const pendingTrack = track(
            'Pending',
            () =>
                new Promise<string>((resolve, reject) => {
                    finishRead = () =>
                        completion === 'resolve' ? resolve(vttText('Pending')) : reject(new Error('Obsolete read'));
                })
        );
        protocol.ready();
        await render([track('Loaded')]);
        await render([pendingTrack]);
        expect(container.firstElementChild?.getAttribute('data-loading')).toBe('true');

        await render([]);
        await act(async () => finishRead());

        expect(container.textContent).toBe('');
        expect(protocol.subtitleMessages.at(-1)?.value).toEqual([]);
        expect(protocol.subtitleMessages.some(({ names }) => names.includes('Pending.vtt'))).toBe(false);
        expect(onError).not.toHaveBeenCalled();
        expect(onLoaded).toHaveBeenCalledTimes(2);
        expect(onLoaded).toHaveBeenLastCalledWith([]);
    });

    it('only sends the latest parsed source when the video becomes ready', async () => {
        await render([track('First')]);
        await render([track('Second')]);
        await act(async () => protocol.ready());

        expect(container.textContent).toBe('Second');
        expect(protocol.subtitleMessages).toHaveLength(1);
        expect(protocol.subtitleMessages[0]).toMatchObject({
            names: ['Second.vtt'],
            value: [expect.objectContaining({ text: 'Second' })],
        });
    });

    it('includes existing annotations when the video attaches after file processing', async () => {
        await render([track('Loaded')]);
        await act(async () => annotate());
        await act(async () => protocol.ready());
        expect(protocol.subtitleMessages[0].value).toMatchObject([
            { text: '<b>Loaded</b>', originalText: 'Loaded', tokenization: { tokens: [] } },
        ]);
    });

    it('keeps loaded annotations when the source configuration is recreated', async () => {
        const tracks = [track('Loaded')];
        await render(tracks);
        await act(async () => annotate());
        await render(tracks);
        expect(container.textContent).toBe('<b>Loaded</b>');
        expect(onLoaded).toHaveBeenCalledTimes(1);
    });

    it('does not send the previous file when a video becomes ready during a replacement parse', async () => {
        let finish!: (text: string) => void;
        await render([track('Old')]);
        await render([
            track(
                'New',
                () =>
                    new Promise<string>((resolve) => {
                        finish = resolve;
                    })
            ),
        ]);
        await act(async () => protocol.ready());
        expect(protocol.subtitleMessages).toEqual([]);
        await act(async () => finish(vttText('New')));
        expect(protocol.subtitleMessages).toMatchObject([{ names: ['New.vtt'], value: [{ text: 'New' }] }]);
        expect(container.textContent).toBe('New');
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
    it('applies the current offset to both retained and newly received remote cues', async () => {
        await act(async () => root.render(<Player tracks={undefined} ownership="remote" progressive />));
        const receive = (update: SubtitleSourceUpdate) =>
            protocol.onMessage?.({ data: { command: 'subtitleSource', update } });
        await act(async () => {
            receive({ type: 'start', track: 0, loadId: 'stream', name: 'progressive.srt' });
            receive({
                type: 'cues',
                track: 0,
                loadId: 'stream',
                cues: [{ cueId: 0, start: 1000, end: 2000, text: 'First' }],
            });
        });
        subtitleOffset = 1250;
        await act(async () =>
            receive({
                type: 'cues',
                track: 0,
                loadId: 'stream',
                cues: [{ cueId: 1, start: 3000, end: 4000, text: 'Second' }],
            })
        );
        expect(Array.from(container.querySelectorAll('span'), (element) => element.dataset.start)).toEqual([
            '2250',
            '4250',
        ]);
    });

    it('accepts an existing remote stream and retains partial results on failure without echoing it', async () => {
        const remote = new SubtitleStream();
        remote.update({ type: 'start', track: 0, loadId: 'remote', name: 'remote.srt' });
        remote.update({
            type: 'cues',
            track: 0,
            loadId: 'remote',
            cues: [{ cueId: 0, start: 1000, end: 2000, text: 'Remote' }],
        });
        protocol.source = remote.sourceSnapshot;
        protocol.ready();
        await act(async () => root.render(<Player tracks={undefined} ownership="remote" progressive />));
        expect(container.textContent).toBe('Remote');
        await act(async () => {
            protocol.onMessage?.({
                data: {
                    command: 'subtitleSource',
                    update: { type: 'failed', track: 0, loadId: 'remote', error: 'Disconnected' },
                },
            });
        });
        expect(container.textContent).toBe('Remote');
        expect(container.firstElementChild?.getAttribute('data-loading')).toBe('false');
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Disconnected' }));
        expect(protocol.sent.filter((message) => message.command === 'subtitleSource')).toEqual([]);
        expect(protocol.sent.filter((message) => message.command === 'requestSubtitleSource')).toHaveLength(1);
    });

    it.each([0, 500, -250])('uses the owner offset %s on initial replay and subsequent batches', async (offset) => {
        subtitleOffset = 900;
        const remote = new SubtitleStream();
        remote.update({ type: 'start', track: 0, loadId: 'remote', name: 'remote.ass' });
        remote.update({
            type: 'cues',
            track: 0,
            loadId: 'remote',
            cues: [{ cueId: 0, start: 1000, end: 2000, text: 'First' }],
        });
        protocol.source = remote.sourceSnapshot;
        protocol.offset = offset;
        protocol.ready();
        await act(async () => root.render(<Player tracks={undefined} ownership="remote" progressive />));
        expect(container.querySelector('span')?.getAttribute('data-start')).toBe(String(1000 + offset));

        await act(async () =>
            protocol.onMessage?.({
                data: {
                    command: 'subtitleSource',
                    update: {
                        type: 'cues',
                        track: 0,
                        loadId: 'remote',
                        cues: [{ cueId: 1, start: 3000, end: 4000, text: 'Second' }],
                    },
                },
            })
        );
        expect(Array.from(container.querySelectorAll('span'), (span) => span.getAttribute('data-start'))).toEqual([
            String(1000 + offset),
            String(3000 + offset),
        ]);
    });

    it('remembers the owner offset when the replay has no cues yet', async () => {
        const remote = new SubtitleStream();
        remote.update({ type: 'start', track: 0, loadId: 'remote', name: 'remote.ass' });
        protocol.source = remote.sourceSnapshot;
        protocol.offset = -250;
        protocol.ready();
        await act(async () => root.render(<Player tracks={undefined} ownership="remote" progressive />));
        await act(async () =>
            protocol.onMessage?.({
                data: {
                    command: 'subtitleSource',
                    update: {
                        type: 'cues',
                        track: 0,
                        loadId: 'remote',
                        cues: [{ cueId: 0, start: 1000, end: 2000, text: 'First' }],
                    },
                },
            })
        );
        expect(container.querySelector('span')?.getAttribute('data-start')).toBe('750');
    });

    it('keeps local files authoritative when a video replays a remote source', async () => {
        protocol.ready();
        await render([track('Local')]);
        await act(async () =>
            protocol.onMessage?.({
                data: { command: 'subtitleSource', update: { type: 'snapshot', tracks: [], offset: 777 } },
            })
        );
        expect(container.textContent).toBe('Local');
        expect(container.querySelector('span')?.getAttribute('data-start')).toBe('1500');
        expect(subtitleOffset).toBe(500);
        expect(protocol.sent.some((message) => message.command === 'requestSubtitleSource')).toBe(false);
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
        protocol.source = remote.sourceSnapshot;
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
        nextProtocol.source = remote.sourceSnapshot;
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

    it('publishes producer updates with the current offset and keeps remote replays from taking ownership', async () => {
        const source = createProducer();
        protocol.ready();
        await act(async () => root.render(<Player tracks={undefined} producer={source.producer} progressive />));
        expect(onStarted).toHaveBeenCalledTimes(1);
        expect(onLoaded).not.toHaveBeenCalled();
        expect(container.firstElementChild?.getAttribute('data-loading')).toBe('true');
        expect(protocol.sent).toEqual([
            {
                command: 'subtitleSource',
                update: {
                    type: 'snapshot',
                    tracks: [{ track: 0, loadId: 'producer', name: 'producer.srt', status: 'loading', cues: [] }],
                    offset: 500,
                },
            },
        ]);
        await act(async () => source.append('First'));
        await act(async () => annotate());
        subtitleOffset = 1000;
        await act(async () => source.append('Second', 1));
        expect(container.textContent).toBe('<b>First</b>Second');
        expect(Array.from(container.querySelectorAll('span'), (element) => element.dataset.start)).toEqual([
            '2000',
            '4000',
        ]);
        await act(async () =>
            protocol.onMessage?.({
                data: { command: 'subtitleSource', update: { type: 'snapshot', tracks: [], offset: 777 } },
            })
        );
        expect(container.textContent).toBe('<b>First</b>Second');
        expect(subtitleOffset).toBe(1000);
        await act(async () => source.finish());
        expect(container.firstElementChild?.getAttribute('data-loading')).toBe('false');
        expect(protocol.sent.at(-1)).toEqual({
            command: 'subtitleSource',
            update: { type: 'complete', track: 0, loadId: 'producer' },
        });
        expect(protocol.subtitleMessages).toEqual([]);
    });

    it('waits for completed producer output before publishing to an older extension', async () => {
        const source = createProducer();
        protocol.ready();
        await act(async () => root.render(<Player tracks={undefined} producer={source.producer} />));
        await act(async () => source.append('First'));
        expect(container.textContent).toBe('');
        expect(protocol.sent).toEqual([]);
        await act(async () => source.finish());
        expect(container.textContent).toBe('First');
        expect(protocol.subtitleMessages).toEqual([
            {
                command: 'subtitles',
                name: 'producer.srt',
                names: ['producer.srt'],
                value: [expect.objectContaining({ text: 'First', start: 1500, originalStart: 1000 })],
            },
        ]);
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
        expect(onStarted).toHaveBeenCalledTimes(1);
        expect(source.signal.aborted).toBe(false);
        expect(nextProtocol.sent).toMatchObject([
            {
                command: 'subtitleSource',
                update: {
                    type: 'snapshot',
                    offset: 500,
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
        expect(onStarted).toHaveBeenCalledTimes(1);
        await act(async () => source.finish());
        expect(container.textContent).toBe('First');
        expect(onError).not.toHaveBeenCalled();
    });

    it('cancels replaced producers and ignores their late output and failures', async () => {
        const first = createProducer('first');
        const second = createProducer('second');
        await act(async () => root.render(<Player tracks={undefined} producer={first.producer} progressive />));
        await act(async () => first.append('First'));
        await act(async () => root.render(<Player tracks={undefined} producer={second.producer} progressive />));
        expect(first.signal.aborted).toBe(true);
        expect(container.textContent).toBe('');
        await act(async () => {
            second.append('Second');
            first.append('Obsolete', 1);
            first.fail(new Error('Obsolete failure'));
        });
        expect(container.textContent).toBe('Second');
        await render([track('Local')]);
        expect(second.signal.aborted).toBe(true);
        await act(async () => second.append('Obsolete', 1));
        expect(container.textContent).toBe('Local');
        expect(onError).not.toHaveBeenCalled();
    });

    it('reports producer rejections, retains received cues, and cancels on unmount', async () => {
        const source = createProducer();
        await act(async () => root.render(<Player tracks={undefined} producer={source.producer} progressive />));
        await act(async () => source.append('First'));
        const error = new Error('Extraction failed');
        await act(async () => source.fail(error));
        expect(onError).toHaveBeenCalledWith(error);
        expect(container.textContent).toBe('First');
        await act(async () => root.render(null));
        expect(source.signal.aborted).toBe(true);
    });

    it('switches a pending file load to a producer without accepting the old parse', async () => {
        let finish!: (text: string) => void;
        const pending = track(
            'Old',
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                })
        );
        protocol.ready();
        await render([pending]);
        const source = createProducer();
        await act(async () => root.render(<Player tracks={undefined} producer={source.producer} progressive />));
        await act(async () => source.append('New'));
        await act(async () => finish(vttText('Old')));
        expect(container.textContent).toBe('New');
        expect(onLoaded).not.toHaveBeenCalled();
        expect(protocol.subtitleMessages).toEqual([]);
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
        protocol.source = source.sourceSnapshot;
        await act(async () => root.render(<Player tracks={undefined} ownership="remote" progressive />));
        expect(container.textContent).toBe('Remote');
        await act(async () => finish(vttText('Old')));
        expect(container.textContent).toBe('Remote');
        expect(onLoaded).not.toHaveBeenCalled();
        expect(protocol.sent.filter((message) => message.command === 'requestSubtitleSource')).toHaveLength(1);
    });
});
