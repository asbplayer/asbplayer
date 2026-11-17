import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// These tests use the real WebVTT reader; its unrelated SRT dependency ships as ESM.
jest.mock('@qgustavor/srt-parser', () => ({ __esModule: true, default: class {} }));

import { SubtitleHtml } from '@project/common';
import type { DisplaySubtitleModel, LoadableSubtitleTrack, SubtitleSourceMessage } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { SubtitleStream } from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceState, SubtitleSourceUpdate } from '@project/common/subtitle-reader/subtitle-stream';
import VideoChannel from '@project/common/app/services/video-channel';
import { SubtitleTracksController } from '@project/common/app/services/subtitle-tracks-controller';
import type {
    SubtitleTracksOptions,
    SubtitleTracksState,
} from '@project/common/app/services/subtitle-tracks-controller';
import {
    TestVideoProtocol,
    track,
    vttText,
    createProducer,
} from '@project/common/app/services/subtitle-tracks-test-utils';

// Drain file-reading, parsing and recovery promises without mounting React.
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('SubtitleTracksController', () => {
    let protocol: TestVideoProtocol;
    let channel: VideoChannel;
    let reader: SubtitleReader;
    let controller: SubtitleTracksController;
    let options: SubtitleTracksOptions;
    let state: SubtitleTracksState;
    let disconnect: () => void;
    let offset: number;
    const onInitialized = jest.fn<() => void>();
    const onSourcesChanged = jest.fn<(sources: readonly SubtitleSourceState[]) => void>();
    const onError = jest.fn<(error: unknown) => void>();
    const shouldRestoreSubtitles = jest.fn<(subtitleCount: number) => Promise<boolean>>();

    const load = async (tracks: LoadableSubtitleTrack<FileWithId>[] | undefined) => {
        controller.setSource({ kind: 'local', tracks, reader, onInitialized });
        await settle();
    };
    const remoteSource = (): SubtitleTracksOptions['source'] => ({
        kind: 'remote',
        supportsProgressiveSubtitles: true,
        onOffset: (value) => {
            offset = value;
        },
        onSourcesChanged,
    });
    const receive = (update: SubtitleSourceMessage['update']) =>
        protocol.onMessage?.({ data: { command: 'subtitleSource', update } });
    const annotate = () => {
        options.subtitles = options.subtitles?.map((cue) => ({
            ...cue,
            originalText: cue.text,
            text: `<b>${cue.text}</b>`,
            tokenization: { tokens: [] },
        }));
    };

    beforeEach(() => {
        onInitialized.mockClear();
        onSourcesChanged.mockClear();
        onError.mockClear();
        shouldRestoreSubtitles.mockReset().mockResolvedValue(true);
        offset = 500;
        protocol = new TestVideoProtocol();
        channel = new VideoChannel(protocol);
        reader = new SubtitleReader({
            regexFilter: '',
            regexFilterTextReplacement: '',
            subtitleHtml: SubtitleHtml.render,
            convertNetflixRuby: false,
            pgsParserWorkerFactory: () => Promise.reject(new Error('PGS is not used in this test')),
        });
        state = { sources: [], loadingFiles: false };
        options = {
            source: { kind: 'local', tracks: undefined, reader, onInitialized },
            subtitles: undefined,
            channel,
            getSubtitleOffset: () => offset,
            shouldRestoreSubtitles,
            onSubtitles: (update) => {
                options.subtitles = update(options.subtitles);
            },
            onError,
        };
        controller = new SubtitleTracksController(options, (value) => {
            state = value;
        });
        disconnect = controller.connect(channel);
    });

    afterEach(() => {
        controller.cancelSource();
        disconnect();
        channel.close();
    });

    it('leaves externally owned subtitles intact when no local tracks are supplied', async () => {
        const external: DisplaySubtitleModel = {
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
        options.subtitles = [external];
        protocol.ready();
        await load(undefined);
        expect(options.subtitles).toEqual([external]);
        expect(protocol.subtitleMessages).toEqual([]);
        expect(onInitialized).not.toHaveBeenCalled();
    });

    it.each(['local', 'remote'] as const)('releases a %s source when local tracks are absent', async (ownership) => {
        if (ownership === 'local') {
            protocol.ready();
            await load([track('Loaded')]);
        } else {
            const remote = new SubtitleStream();
            remote.replace(
                [{ track: 0, start: 1000, end: 2000, text: 'Loaded', originalStart: 1000, originalEnd: 2000 }],
                ['Loaded.vtt']
            );
            protocol.source = remote.sourceSnapshot();
            controller.setSource(remoteSource());
            protocol.ready();
        }
        expect(state.sources).toHaveLength(1);
        const sent = protocol.subtitleMessages.length;
        await load(undefined);
        protocol.ready();
        await settle();
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['Loaded']);
        expect(state).toEqual({ sources: [], loadingFiles: false });
        expect(protocol.subtitleMessages).toHaveLength(sent);
    });

    it('clears stale cues and finishes loading when the current file cannot be read', async () => {
        protocol.ready();
        await load([track('Loaded')]);
        const error = new Error('File unavailable');
        const broken = track('Broken', async () => {
            throw error;
        });
        await load([broken]);
        expect(options.subtitles).toEqual([]);
        expect(state.loadingFiles).toBe(false);
        expect(protocol.subtitleMessages.at(-1)).toMatchObject({ value: [], names: ['Broken.vtt'] });
        expect(onError).toHaveBeenCalledWith(error);
        expect(onInitialized).toHaveBeenLastCalledWith();
    });

    it.each(['resolve', 'reject'] as const)('ignores an old parse that %ss after a clear', async (completion) => {
        let finish!: () => void;
        const pending = track(
            'Pending',
            () =>
                new Promise<string>((resolve, reject) => {
                    finish = () =>
                        completion === 'resolve' ? resolve(vttText('Pending')) : reject(new Error('Obsolete read'));
                })
        );
        protocol.ready();
        await load([track('Loaded')]);
        await load([pending]);
        expect(state.loadingFiles).toBe(true);
        await load([]);
        finish();
        await settle();
        expect(options.subtitles).toEqual([]);
        expect(state.loadingFiles).toBe(false);
        expect(protocol.subtitleMessages.at(-1)?.value).toEqual([]);
        expect(protocol.subtitleMessages.some(({ names }) => names.includes('Pending.vtt'))).toBe(false);
        expect(onError).not.toHaveBeenCalled();
        expect(onInitialized).toHaveBeenCalledTimes(2);
        expect(onInitialized).toHaveBeenLastCalledWith();
    });

    it('sends only the latest parsed source when the video becomes ready', async () => {
        await load([track('First')]);
        await load([track('Second')]);
        protocol.ready();
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['Second']);
        expect(protocol.subtitleMessages).toMatchObject([{ names: ['Second.vtt'], value: [{ text: 'Second' }] }]);
    });

    it('loads files without a connected channel and sends annotations on later attachment', async () => {
        disconnect();
        disconnect = controller.connect(undefined);
        await load([track('Loaded')]);
        annotate();
        disconnect();
        disconnect = controller.connect(channel);
        protocol.ready();
        expect(protocol.subtitleMessages[0].value).toMatchObject([
            { text: '<b>Loaded</b>', originalText: 'Loaded', tokenization: { tokens: [] } },
        ]);
    });

    it('avoids older side-panel reload loops while allowing recovery, replacements, and clears', async () => {
        let videoHasSubtitles = true;
        shouldRestoreSubtitles.mockImplementation(async (count) => count > 0 && !videoHasSubtitles);
        protocol.onSubtitles = () => {
            videoHasSubtitles = protocol.subtitleMessages.at(-1)!.value.length > 0;
            protocol.ready();
        };
        await load([track('Local')]);
        protocol.ready();
        await settle();
        expect(protocol.subtitleMessages).toHaveLength(1);
        protocol.ready();
        protocol.ready();
        await settle();
        expect(protocol.subtitleMessages).toHaveLength(1);
        videoHasSubtitles = false;
        protocol.ready();
        await settle();
        expect(protocol.subtitleMessages).toHaveLength(2);
        expect(protocol.subtitleMessages.at(-1)?.value[0].text).toBe('Local');
        await load([track('Replacement')]);
        expect(protocol.subtitleMessages).toHaveLength(3);
        expect(protocol.subtitleMessages.at(-1)?.value[0].text).toBe('Replacement');
        await load([]);
        expect(protocol.subtitleMessages).toHaveLength(4);
        expect(protocol.subtitleMessages.at(-1)?.value).toEqual([]);
    });

    it('uses the latest annotations after a delayed recovery check', async () => {
        protocol.ready();
        await load([track('Loaded')]);
        let finish!: (restore: boolean) => void;
        shouldRestoreSubtitles.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                })
        );
        protocol.ready();
        annotate();
        finish(true);
        await settle();
        expect(protocol.subtitleMessages).toHaveLength(2);
        expect(protocol.subtitleMessages.at(-1)?.value).toMatchObject([
            { text: '<b>Loaded</b>', originalText: 'Loaded', tokenization: { tokens: [] } },
        ]);
    });

    it('uses the current file source after a delayed recovery check', async () => {
        protocol.ready();
        await load([track('Loaded')]);
        let finish!: (restore: boolean) => void;
        shouldRestoreSubtitles.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                })
        );
        protocol.ready();
        await load([track('New')]);
        finish(true);
        await settle();
        expect(protocol.subtitleMessages.at(-1)?.value).toMatchObject([{ text: 'New' }]);
        expect(protocol.subtitleMessages.slice(1).every(({ value }) => value[0].text === 'New')).toBe(true);
    });

    it('leaves the video unchanged when a recovery check fails and permits a later retry', async () => {
        protocol.ready();
        await load([track('Loaded')]);
        const error = new Error('Video unavailable');
        shouldRestoreSubtitles.mockRejectedValueOnce(error);
        protocol.ready();
        await settle();
        expect(protocol.subtitleMessages).toHaveLength(1);
        expect(onError).toHaveBeenCalledWith(error);
        protocol.ready();
        await settle();
        expect(protocol.subtitleMessages).toHaveLength(2);
    });

    it('does not send the previous file when readiness arrives during a replacement parse', async () => {
        let finish!: (text: string) => void;
        await load([track('Old')]);
        await load([
            track(
                'New',
                () =>
                    new Promise((resolve) => {
                        finish = resolve;
                    })
            ),
        ]);
        protocol.ready();
        expect(protocol.subtitleMessages).toEqual([]);
        finish(vttText('New'));
        await settle();
        expect(protocol.subtitleMessages).toMatchObject([{ names: ['New.vtt'], value: [{ text: 'New' }] }]);
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['New']);
    });

    it('reports remote track metadata before cues arrive and clears it for an empty snapshot', () => {
        controller.setSource(remoteSource());
        expect(onSourcesChanged).not.toHaveBeenCalled();
        receive({
            type: 'snapshot',
            tracks: [{ track: 2, loadId: 'companion', name: 'companion.vtt', status: 'complete', cues: [] }],
            offset: 0,
        });
        expect(onSourcesChanged).toHaveBeenLastCalledWith([
            { track: 2, loadId: 'companion', name: 'companion.vtt', status: 'complete' },
        ]);
        receive({ type: 'start', track: 0, loadId: 'embedded', name: 'embedded.ass' });
        expect(onSourcesChanged.mock.calls.at(-1)?.[0]).toEqual(
            expect.arrayContaining([
                { track: 2, loadId: 'companion', name: 'companion.vtt', status: 'complete' },
                { track: 0, loadId: 'embedded', name: 'embedded.ass', status: 'loading' },
            ])
        );
        receive({ type: 'snapshot', tracks: [], offset: 0 });
        expect(onSourcesChanged).toHaveBeenLastCalledWith([]);
        expect(protocol.subtitleMessages).toEqual([]);
    });

    it('applies the current offset to both retained and newly received remote cues', () => {
        controller.setSource(remoteSource());
        receive({ type: 'start', track: 0, loadId: 'stream', name: 'progressive.srt' });
        receive({
            type: 'cues',
            track: 0,
            loadId: 'stream',
            cues: [{ cueId: 0, start: 1000, end: 2000, text: 'First' }],
        });
        offset = 1250;
        receive({
            type: 'cues',
            track: 0,
            loadId: 'stream',
            cues: [{ cueId: 1, start: 3000, end: 4000, text: 'Second' }],
        });
        expect(options.subtitles?.map((cue) => cue.start)).toEqual([2250, 4250]);
    });

    it('accepts an existing remote stream and retains partial results on failure without echoing it', () => {
        const remote = new SubtitleStream();
        remote.update({ type: 'start', track: 0, loadId: 'remote', name: 'remote.srt' });
        remote.update({
            type: 'cues',
            track: 0,
            loadId: 'remote',
            cues: [{ cueId: 0, start: 1000, end: 2000, text: 'Remote' }],
        });
        protocol.source = remote.sourceSnapshot();
        controller.setSource(remoteSource());
        protocol.ready();
        receive({ type: 'failed', track: 0, loadId: 'remote', error: 'Disconnected' });
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['Remote']);
        expect(state.sources[0].status).toBe('failed');
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Disconnected' }));
        expect(protocol.sent.map((message) => message.command)).toEqual(['requestSubtitleSource']);
    });

    it.each([0, 500, -250])('uses the owner offset %s on initial replay and subsequent batches', (ownerOffset) => {
        offset = 900;
        const remote = new SubtitleStream();
        remote.update({ type: 'start', track: 0, loadId: 'remote', name: 'remote.ass' });
        remote.update({
            type: 'cues',
            track: 0,
            loadId: 'remote',
            cues: [{ cueId: 0, start: 1000, end: 2000, text: 'First' }],
        });
        protocol.source = remote.sourceSnapshot();
        protocol.offset = ownerOffset;
        controller.setSource(remoteSource());
        protocol.ready();
        expect(options.subtitles?.[0].start).toBe(1000 + ownerOffset);
        receive({
            type: 'cues',
            track: 0,
            loadId: 'remote',
            cues: [{ cueId: 1, start: 3000, end: 4000, text: 'Second' }],
        });
        expect(options.subtitles?.map((cue) => cue.start)).toEqual([1000 + ownerOffset, 3000 + ownerOffset]);
    });

    it('remembers the owner offset when the initial replay has no cues', () => {
        const remote = new SubtitleStream();
        remote.update({ type: 'start', track: 0, loadId: 'remote', name: 'remote.ass' });
        protocol.source = remote.sourceSnapshot();
        protocol.offset = -250;
        controller.setSource(remoteSource());
        protocol.ready();
        receive({
            type: 'cues',
            track: 0,
            loadId: 'remote',
            cues: [{ cueId: 0, start: 1000, end: 2000, text: 'First' }],
        });
        expect(options.subtitles?.[0].start).toBe(750);
    });

    it('keeps local files authoritative when a video replays a remote source', async () => {
        protocol.ready();
        await load([track('Local')]);
        receive({ type: 'snapshot', tracks: [], offset: 777 });
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['Local']);
        expect(options.subtitles?.[0].start).toBe(1500);
        expect(offset).toBe(500);
        expect(onSourcesChanged).not.toHaveBeenCalled();
        expect(protocol.sent.some((message) => message.command === 'requestSubtitleSource')).toBe(false);
    });

    it('publishes producer updates with the current offset and ignores remote replays', () => {
        const source = createProducer();
        protocol.ready();
        controller.setSource({
            kind: 'producer',
            producer: source.producer,
            supportsProgressiveSubtitles: true,
            onInitialized,
        });
        expect(onInitialized).toHaveBeenCalledTimes(1);
        expect(state.sources[0].status).toBe('loading');
        expect(protocol.sent).toEqual([
            {
                command: 'subtitleSource',
                update: {
                    type: 'snapshot',
                    tracks: [{ track: 0, loadId: 'producer', name: 'producer.srt', status: 'loading', cues: [] }],
                },
            },
        ]);
        source.append('First');
        annotate();
        offset = 1000;
        source.append('Second', 1);
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['<b>First</b>', 'Second']);
        expect(options.subtitles?.map((cue) => cue.start)).toEqual([2000, 4000]);
        receive({ type: 'snapshot', tracks: [], offset: 777 });
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['<b>First</b>', 'Second']);
        expect(offset).toBe(1000);
        source.finish();
        expect(state.sources[0].status).toBe('complete');
        expect(protocol.sent.at(-1)).toEqual({
            command: 'subtitleSource',
            update: { type: 'complete', track: 0, loadId: 'producer' },
        });
        expect(protocol.subtitleMessages).toEqual([]);
    });

    it('waits for completed producer output before publishing to an older extension', () => {
        const source = createProducer();
        protocol.ready();
        controller.setSource({
            kind: 'producer',
            producer: source.producer,
            supportsProgressiveSubtitles: false,
            onInitialized,
        });
        source.append('First');
        expect(options.subtitles).toBeUndefined();
        expect(protocol.sent).toEqual([]);
        source.finish();
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['First']);
        expect(protocol.subtitleMessages).toEqual([
            {
                command: 'subtitles',
                name: 'producer.srt',
                names: ['producer.srt'],
                value: [expect.objectContaining({ text: 'First', start: 1500, originalStart: 1000 })],
            },
        ]);
    });

    it('cancels replaced producers and ignores their late output and failures', async () => {
        const first = createProducer('first');
        const second = createProducer('second');
        controller.setSource({
            kind: 'producer',
            producer: first.producer,
            supportsProgressiveSubtitles: true,
            onInitialized,
        });
        first.append('First');
        controller.setSource({
            kind: 'producer',
            producer: second.producer,
            supportsProgressiveSubtitles: true,
            onInitialized,
        });
        expect(first.signal.aborted).toBe(true);
        expect(options.subtitles).toEqual([]);
        second.append('Second');
        first.append('Obsolete', 1);
        first.fail(new Error('Obsolete failure'));
        await settle();
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['Second']);
        await load([track('Local')]);
        expect(second.signal.aborted).toBe(true);
        second.append('Obsolete', 1);
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['Local']);
        expect(onError).not.toHaveBeenCalled();
    });

    it('reports producer rejections, retains received cues, and cancels the source', async () => {
        const source = createProducer();
        controller.setSource({
            kind: 'producer',
            producer: source.producer,
            supportsProgressiveSubtitles: true,
            onInitialized,
        });
        source.append('First');
        const error = new Error('Extraction failed');
        source.fail(error);
        await settle();
        expect(onError).toHaveBeenCalledWith(error);
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['First']);
        controller.cancelSource();
        expect(source.signal.aborted).toBe(true);
    });

    it('retains partial cues and reports a producer failure update', () => {
        const source = createProducer();
        protocol.ready();
        controller.setSource({
            kind: 'producer',
            producer: source.producer,
            supportsProgressiveSubtitles: true,
            onInitialized,
        });
        source.append('First');
        source.publish({ type: 'failed', track: 0, loadId: 'producer', error: 'Disconnected' });
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['First']);
        expect(state.sources[0].status).toBe('failed');
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Disconnected' }));
        expect(protocol.sent.at(-1)).toEqual({
            command: 'subtitleSource',
            update: { type: 'failed', track: 0, loadId: 'producer', error: 'Disconnected' },
        });
    });

    it.each(['remote', 'producer'] as const)('ignores obsolete updates from an active %s source', (kind) => {
        const source = createProducer();
        protocol.ready();
        if (kind === 'remote') {
            controller.setSource(remoteSource());
            receive({ type: 'start', track: 0, loadId: 'current', name: 'current.srt' });
        } else {
            controller.setSource({
                kind: 'producer',
                producer: source.producer,
                supportsProgressiveSubtitles: true,
                onInitialized,
            });
        }
        const before = options.subtitles;
        const sent = protocol.sent.length;
        const reported = onSourcesChanged.mock.calls.length;
        const obsolete: SubtitleSourceUpdate = { type: 'failed', track: 0, loadId: 'obsolete', error: 'Old failure' };
        if (kind === 'remote') receive(obsolete);
        else source.publish(obsolete);
        expect(options.subtitles).toBe(before);
        expect(protocol.sent).toHaveLength(sent);
        expect(onSourcesChanged).toHaveBeenCalledTimes(reported);
        expect(onError).not.toHaveBeenCalled();
    });

    it('switches a pending file load to a producer without accepting the old parse', async () => {
        let finish!: (text: string) => void;
        protocol.ready();
        await load([
            track(
                'Old',
                () =>
                    new Promise((resolve) => {
                        finish = resolve;
                    })
            ),
        ]);
        const source = createProducer();
        controller.setSource({
            kind: 'producer',
            producer: source.producer,
            supportsProgressiveSubtitles: true,
            onInitialized,
        });
        source.append('New');
        finish(vttText('Old'));
        await settle();
        expect(options.subtitles?.map((cue) => cue.text)).toEqual(['New']);
        expect(onInitialized).toHaveBeenCalledTimes(1);
        expect(protocol.subtitleMessages).toEqual([]);
    });
});
