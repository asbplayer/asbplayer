import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// These unrelated parsers ship as ESM. The tests below use the real WebVTT parser.
jest.mock('@qgustavor/srt-parser', () => ({ __esModule: true, default: class {} }));
jest.mock('ass-compiler', () => ({ compile: () => ({ dialogues: [] }) }));

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
import { SubtitleStream } from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceSnapshot, SubtitleSourceUpdate } from '@project/common/subtitle-reader/subtitle-stream';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class TestVideoProtocol implements VideoProtocol {
    readonly sent: Message[] = [];
    source?: SubtitleSourceSnapshot;
    onMessage?: (message: VideoProtocolMessage) => void;

    postMessage(message: Message) {
        this.sent.push(message);
        if (message.command === 'requestSubtitleSource' && this.source) {
            this.onMessage?.({
                data: { command: 'subtitleSource', update: { type: 'snapshot', ...this.source } },
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

describe('useSubtitleTracks source transitions', () => {
    let root: Root;
    let container: HTMLDivElement;
    let protocol: TestVideoProtocol;
    let channel: VideoChannel;
    let reader: SubtitleReader;
    let annotate: () => void;
    const onLoaded = jest.fn<(subtitleSourceFiles: File[]) => void>();
    const onError = jest.fn<(error: unknown) => void>();

    function Player({
        tracks,
        activeChannel = channel,
        initialSubtitles,
        progressive = false,
        ownership = 'local',
    }: {
        tracks: LoadableSubtitleTrack<FileWithId>[] | undefined;
        activeChannel?: VideoChannel;
        initialSubtitles?: DisplaySubtitleModel[];
        progressive?: boolean;
        ownership?: 'local' | 'remote';
    }) {
        const [subtitles, setSubtitles] = useState<DisplaySubtitleModel[] | undefined>(initialSubtitles);
        const result = useSubtitleTracks({
            sourceOwnership: ownership,
            subtitleTracks: tracks,
            supportsProgressiveSubtitles: progressive,
            subtitleReader: reader,
            subtitles,
            channel: activeChannel,
            getSubtitleOffset,
            onSubtitles: setSubtitles,
            onLoaded,
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
        protocol.source = remote.snapshot;
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

    it('keeps local files authoritative when a video replays a remote source', async () => {
        protocol.ready();
        await render([track('Local')]);
        await act(async () =>
            protocol.onMessage?.({
                data: { command: 'subtitleSource', update: { type: 'snapshot', tracks: [], subtitles: [] } },
            })
        );
        expect(container.textContent).toBe('Local');
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
        protocol.source = remote.snapshot;
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
        nextProtocol.source = remote.snapshot;
        const nextChannel = new VideoChannel(nextProtocol);
        await act(async () =>
            root.render(<Player tracks={undefined} ownership="remote" activeChannel={nextChannel} progressive />)
        );
        await act(async () => nextProtocol.ready());

        expect(container.textContent).toBe('<b>First</b>Second');
        expect(nextProtocol.sent.map((message) => message.command)).toEqual(['requestSubtitleSource']);
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
        protocol.source = source.snapshot;
        await act(async () => root.render(<Player tracks={undefined} ownership="remote" progressive />));
        expect(container.textContent).toBe('Remote');
        await act(async () => finish(vttText('Old')));
        expect(container.textContent).toBe('Remote');
        expect(onLoaded).not.toHaveBeenCalled();
        expect(protocol.sent.filter((message) => message.command === 'requestSubtitleSource')).toHaveLength(1);
    });
});
