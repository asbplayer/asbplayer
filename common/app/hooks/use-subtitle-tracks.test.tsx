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

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class TestVideoProtocol implements VideoProtocol {
    readonly sent: Message[] = [];
    onMessage?: (message: VideoProtocolMessage) => void;

    postMessage(message: Message) {
        this.sent.push(message);
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
const getSubtitleOffset = () => 500;

describe('useSubtitleTracks source transitions', () => {
    let root: Root;
    let container: HTMLDivElement;
    let protocol: TestVideoProtocol;
    let channel: VideoChannel;
    let reader: SubtitleReader;
    const onLoaded = jest.fn<(subtitleSourceFiles: File[]) => void>();
    const onError = jest.fn<(error: unknown) => void>();

    function Player({
        tracks,
        activeChannel = channel,
        initialSubtitles,
    }: {
        tracks: LoadableSubtitleTrack<FileWithId>[] | undefined;
        activeChannel?: VideoChannel;
        initialSubtitles?: DisplaySubtitleModel[];
    }) {
        const [subtitles, setSubtitles] = useState<DisplaySubtitleModel[] | undefined>(initialSubtitles);
        const { loadingSubtitles } = useSubtitleTracks({
            subtitleTracks: tracks,
            subtitleReader: reader,
            subtitles,
            channel: activeChannel,
            getSubtitleOffset,
            onSubtitles: setSubtitles,
            onLoaded,
            onError,
        });
        return (
            <div data-loading={loadingSubtitles}>
                {subtitles?.map((subtitle) => (
                    <span key={subtitle.index}>{subtitle.text}</span>
                ))}
            </div>
        );
    }

    const render = async (tracks: LoadableSubtitleTrack<FileWithId>[] | undefined) => {
        await act(async () => root.render(<Player tracks={tracks} />));
    };

    beforeEach(() => {
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
});
