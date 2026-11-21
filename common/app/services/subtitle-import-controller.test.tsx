import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest } from '@jest/globals';
import React, { act, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { TextDecoder, TextEncoder } from 'util';
import { SubtitleHtml } from '@project/common';
import type { ConfirmedVideoDataSubtitleTrack, DisplaySubtitleModel } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { FileSessionRecord } from '@project/common/file-system-access';
import { useSubtitleSelection } from '@project/common/app/hooks/use-subtitle-selection';
import { useSubtitleTracks } from '@project/common/app/hooks/use-subtitle-tracks';
import { MediaSources } from '@project/common/app/services/media-sources';
import { SubtitleImportController } from '@project/common/app/services/subtitle-import-controller';
import type {
    SubtitleImportOptions,
    SubtitleImportState,
} from '@project/common/app/services/subtitle-import-controller';
import { TestVideoProtocol } from '@project/common/app/services/subtitle-tracks-test-utils';
import VideoChannel from '@project/common/app/services/video-channel';
import { EmbeddedSubtitles } from '@project/common/embedded-subtitles/embedded-subtitles';
import { embeddedDescriptor, embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import type {
    ExtractedSubtitleFile,
    SubtitleExtractionOptions,
} from '@project/common/embedded-subtitles/subtitle-source';
import { mkv, mkvTrack } from '@project/common/media-probe/test-media';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { subtitleKey } from '@project/common/subtitle-reader/subtitle-stream';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const encoder = new TextEncoder();
const originalText = Object.getOwnPropertyDescriptor(Blob.prototype, 'text');

beforeAll(() => {
    Object.assign(globalThis, { TextDecoder });
    if (!AbortSignal.prototype.throwIfAborted) {
        AbortSignal.prototype.throwIfAborted = function () {
            if (this.aborted) throw this.reason;
        };
    }
    Object.defineProperty(Blob.prototype, 'text', {
        configurable: true,
        value: function (this: Blob) {
            return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(reader.error);
                reader.readAsText(this);
            });
        },
    });
});
afterAll(() => {
    if (originalText) Object.defineProperty(Blob.prototype, 'text', originalText);
    else Reflect.deleteProperty(Blob.prototype, 'text');
});

let root: Root;
let controller: SubtitleImportController;
let unloadVideo: () => void;
let subtitles: DisplaySubtitleModel[] | undefined;
let currentSources: MediaSources;
let extraction: SubtitleExtractionOptions;
let finish: (files: ExtractedSubtitleFile[]) => void;
let record: FileSessionRecord | undefined;
let picker: SubtitleImportOptions['picker'];
let session: SubtitleImportOptions['session'];
let video: FileWithId;
let choice: ConfirmedVideoDataSubtitleTrack;
let protocol: TestVideoProtocol;
const onError = jest.fn<(error: unknown) => void>();
const onCompleted = jest.fn<SubtitleImportOptions['onCompleted']>();
const extract = jest.fn<(options: SubtitleExtractionOptions) => Promise<ExtractedSubtitleFile[]>>();
const reader = new SubtitleReader({
    regexFilter: '',
    regexFilterTextReplacement: '',
    subtitleHtml: SubtitleHtml.render,
    convertNetflixRuby: false,
    pgsParserWorkerFactory: async () => {
        throw new Error('Text source');
    },
});

function Harness({ channel, selectedTrackIds }: { channel: VideoChannel; selectedTrackIds: string[] }) {
    const [sources, setSources] = useState(() => new MediaSources(undefined, video));
    currentSources = sources;
    const [state, setState] = useState<SubtitleImportState>({ embeddedSelection: undefined, discoveryKey: undefined });
    const selection = useSubtitleSelection({
        source: sources.videoFile,
        service: picker.embedded.service,
        selectedTrackIds,
        sources,
    });
    const options: SubtitleImportOptions = {
        sources,
        picker,
        selection,
        session,
        restoreError: 'Failed to restore session',
        onSources: (incoming) =>
            setSources(new MediaSources(incoming.subtitleSource, incoming.videoFile ?? sources.videoFile)),
        onCompleted: (source, tracks, signal) => {
            onCompleted(source, tracks, signal);
            setSources(
                new MediaSources(
                    {
                        kind: 'files',
                        pendingEmbedded: false,
                        tracks: tracks.map(({ fileParts }, track) => ({
                            fileParts: fileParts.map((file) => ({ ...file, track })),
                        })),
                    },
                    source
                )
            );
        },
        onError,
    };
    const [importController] = useState(() => new SubtitleImportController(options, setState));
    controller = importController;
    controller.options = options;
    unloadVideo = () => {
        const pending = controller.unloadVideo();
        setSources((previous) => previous.withoutVideo(pending));
    };
    const service = picker.embedded.service;
    const producer = useMemo(
        () =>
            importController.createProducer(state.embeddedSelection, {
                reader,
                service,
                errorMessage: 'Failed to load embedded subtitles',
            }),
        [importController, state.embeddedSelection, service]
    );
    const [displayed, setDisplayed] = useState<DisplaySubtitleModel[]>();
    subtitles = displayed;
    useSubtitleTracks({
        source: producer
            ? { kind: 'producer', producer, supportsProgressiveSubtitles: true, onInitialized: () => {} }
            : { kind: 'local', tracks: sources.subtitleTracks, reader, onInitialized: () => {} },
        subtitles: displayed,
        channel,
        getSubtitleOffset: () => 0,
        shouldRestoreSubtitles: async () => true,
        onSubtitles: setDisplayed,
        onError,
    });
    return null;
}

beforeEach(() => {
    onError.mockClear();
    onCompleted.mockClear();
    extract.mockReset().mockImplementation((options) => {
        extraction = options;
        return new Promise((resolve, reject) => {
            finish = resolve;
            options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        });
    });
    record = undefined;
    const bytes = Uint8Array.from(mkv(mkvTrack(1, 'V_VP8'), mkvTrack(17, 'S_TEXT/UTF8'))).buffer;
    const file = new File([], 'video.mkv', { lastModified: 1 });
    Object.defineProperty(file, 'size', { value: bytes.byteLength });
    file.slice = () => ({ arrayBuffer: async () => bytes }) as Blob;
    video = { id: 'video', file };
    choice = {
        id: embeddedSubtitleId(video.id, 0),
        embedded: embeddedDescriptor(video, { trackIndex: 0, codec: 'subrip' }),
        label: 'English',
        name: 'English',
        extension: 'srt',
    };
    picker = {
        embedded: { service: new EmbeddedSubtitles({ extractSubtitles: extract }), cancel: jest.fn() },
        subtitleTrackSelectorOpen: true,
        closeSubtitleTrackSelector: jest.fn(),
        openSubtitleTrackSelectorWithFiles: jest.fn(),
        onManualFilesImported: jest.fn(),
        setSubtitleTrackSelectorTracks: jest.fn(),
        setSubtitleTrackSelectorSelectedTrackIds: jest.fn(),
    };
    session = {
        fetchSession: jest.fn(async () => record),
        saveSession: jest.fn(async () => {}),
        saveDraftHandlesToSession: jest.fn(async () => {}),
        promoteDraftHandlesInSession: jest.fn(async () => {}),
        clearDraftHandlesInSession: jest.fn(async () => {}),
        saveSubtitleSelection: jest.fn(async () => {}),
    };
    protocol = new TestVideoProtocol();
    root = createRoot(document.createElement('div'));
});

afterEach(() => {
    act(() => root.unmount());
    controller.dispose();
    jest.restoreAllMocks();
});

const render = async (selectedTrackIds = [choice.id]) =>
    act(async () => root.render(<Harness channel={new VideoChannel(protocol)} selectedTrackIds={selectedTrackIds} />));
const confirm = async () => act(async () => controller.confirm([choice]));
const emit = (text: string) => extraction.onChunk(0, encoder.encode(text).buffer);
const srt = '1\n00:00:01,000 --> 00:00:02,000\nFirst\n\n';

it('reselects a completed embedded subtitle as a standalone file and saves it after unload', async () => {
    await render();
    await confirm();
    await act(async () => finish([{ trackKey: 0, format: 'srt', blob: new Blob([srt]) }]));
    const extracted = currentSources.subtitleSourceFiles[0];
    expect(extracted.embedded).toBeDefined();

    await act(async () => unloadVideo());
    expect(currentSources.videoFile).toBeUndefined();
    const retained = currentSources.firstSubtitleSourceFiles[0]!;
    choice = { ...choice, file: retained.file, embedded: retained.embedded };
    await confirm();

    expect(session.saveSubtitleSelection).toHaveBeenLastCalledWith(
        [{ fileParts: [{ id: extracted.id, file: extracted.file, track: 0 }] }],
        new Set()
    );
    expect(extract).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
});

it('starts extraction while session storage is busy and saves completed bytes last', async () => {
    await render();
    let promote!: () => void;
    session.promoteDraftHandlesInSession = () => new Promise((resolve) => (promote = resolve));

    await confirm();
    expect(picker.closeSubtitleTrackSelector).toHaveBeenCalled();
    expect(extract).toHaveBeenCalledTimes(1);
    expect(session.saveSubtitleSelection).not.toHaveBeenCalled();

    await act(async () => controller.closePicker());
    const file = new Blob([srt], { type: 'application/x-subrip' });
    await act(async () => finish([{ trackKey: 0, format: 'srt', blob: file }]));
    expect(currentSources.canDownloadSubtitles).toBe(true);
    expect(session.saveSubtitleSelection).not.toHaveBeenCalled();

    await act(async () => promote());
    expect(session.saveSubtitleSelection).toHaveBeenLastCalledWith(onCompleted.mock.calls[0][1], new Set());
    expect(onCompleted.mock.calls[0][1][0].fileParts[0].file.size).toBe(file.size);
});

it('saves only the latest selection when a second confirmation overtakes a pending session write', async () => {
    await render();
    let promote!: () => void;
    session.promoteDraftHandlesInSession = jest
        .fn<() => Promise<void>>()
        .mockImplementationOnce(() => new Promise((resolve) => (promote = resolve)))
        .mockResolvedValue(undefined);
    await confirm();
    expect(extract).toHaveBeenCalledTimes(1);

    const local = { id: 'local', file: new File([srt], 'local.srt') };
    choice = { ...local, name: 'local', label: 'local.srt', extension: 'srt' };
    await render();
    await confirm();
    expect(extraction.signal.aborted).toBe(true);

    await act(async () => promote());
    expect(session.saveSubtitleSelection).toHaveBeenCalledTimes(1);
    expect(session.saveSubtitleSelection).toHaveBeenCalledWith([{ fileParts: [local] }], new Set());
});

it('hands confirmed extraction to the shared controller and persists completion without replacing cue identity or restarting', async () => {
    await render();
    protocol.ready();
    await confirm();
    expect(extract).toHaveBeenCalledTimes(1);
    expect(session.saveSubtitleSelection).toHaveBeenCalledWith(expect.any(Array), new Set([choice.id]));
    expect(onCompleted).not.toHaveBeenCalled();
    expect(currentSources.canDownloadSubtitles).toBe(false);
    await act(async () => emit(srt));
    expect(subtitles?.map(({ text }) => text)).toEqual(['First']);
    const keys = subtitles!.map(subtitleKey);
    // Closing the already-confirmed picker must not cancel the player's extraction.
    await act(async () => controller.closePicker());
    expect(extraction.signal.aborted).toBe(false);
    await act(async () => finish([{ trackKey: 0, format: 'srt', blob: new Blob([srt]) }]));
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(currentSources.canDownloadSubtitles).toBe(true);
    expect(subtitles!.map(subtitleKey)).toEqual(keys);
    expect(currentSources.subtitleSourceFiles[0].file.size).toBeGreaterThan(0);
    expect(session.saveSubtitleSelection).toHaveBeenLastCalledWith(onCompleted.mock.calls[0][1], new Set());
    expect(await currentSources.subtitleSourceFiles[0].file.text()).toBe(srt);
    await act(async () => protocol.ready());
    expect(subtitles!.map(subtitleKey)).toEqual(keys);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
});

it('keeps the extraction and published cues when confirming the same selection again', async () => {
    await render();
    await confirm();
    await act(async () => emit(srt));
    const signal = extraction.signal;
    const keys = subtitles!.map(subtitleKey);
    expect(keys).toHaveLength(1);

    await render([choice.id, '-']); // The picker can add empty slots to a shorter saved selection.
    const empty = { id: '-', name: '', label: '', extension: 'srt' };
    await act(async () => controller.confirm([choice, empty]));
    expect(signal.aborted).toBe(false);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(subtitles!.map(subtitleKey)).toEqual(keys);

    await act(async () => finish([{ trackKey: 0, format: 'srt', blob: new Blob([srt]) }]));
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(currentSources.canDownloadSubtitles).toBe(true);
});

it('keeps the completed file when extraction finishes during another confirmation', async () => {
    await render();
    await confirm();
    await act(async () => emit(srt));
    let resume!: (record: FileSessionRecord | undefined) => void;
    session.fetchSession = () =>
        new Promise((resolve) => {
            resume = resolve;
        });
    await confirm();
    expect(resume).toBeDefined();

    await act(async () => finish([{ trackKey: 0, format: 'srt', blob: new Blob([srt]) }]));
    const file = currentSources.subtitleSourceFiles[0].file;
    await act(async () => resume(undefined));

    expect(extract).toHaveBeenCalledTimes(1);
    expect(currentSources.subtitleSourceFiles[0].file).toBe(file);
    expect(subtitles?.map(({ text }) => text)).toEqual(['First']);
    expect(session.saveSubtitleSelection).toHaveBeenLastCalledWith(
        [{ fileParts: [expect.objectContaining({ file })] }],
        new Set()
    );
});

it('aborts the real extraction on source replacement and rejects late chunks and completion', async () => {
    await render();
    await confirm();
    await act(async () => emit(srt));
    const old = extraction;
    const replacement = { id: 'external', file: new File([], 'external.vtt') };
    Object.defineProperty(replacement.file, 'text', {
        value: async () => 'WEBVTT\n\n00:00:03.000 --> 00:00:04.000\nReplacement\n',
    });
    await act(async () => {
        controller.loadSourceFiles([replacement]);
    });
    expect(old.signal.aborted).toBe(true);
    expect(subtitles?.map(({ text }) => text)).toEqual(['Replacement']);
    await act(async () => {
        expect(() => old.onChunk(0, encoder.encode(srt).buffer)).toThrow();
        finish([{ trackKey: 0, format: 'srt', blob: new Blob([srt]) }]);
    });
    expect(subtitles?.map(({ text }) => text)).toEqual(['Replacement']);
    expect(onCompleted).not.toHaveBeenCalled();
    expect(session.saveSubtitleSelection).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
});

it('does not apply a restored session after another import supersedes it', async () => {
    await render();
    let resolve!: (record: FileSessionRecord | undefined) => void;
    session.fetchSession = () =>
        new Promise((done) => {
            resolve = done;
        });
    let restore!: Promise<void>;
    act(() => {
        restore = controller.restoreSession();
    });
    const replacement = { id: 'other-video', file: new File([], 'other.mkv') };
    await act(async () => {
        controller.loadSourceFiles([replacement]);
    });
    await act(async () => {
        resolve({
            id: 1,
            timestamp: 1,
            videoHandle: { id: video.id, handle: {} as FileSystemFileHandle },
            subtitleHandles: [],
        });
        await restore;
    });
    expect(currentSources.videoFile).toBe(replacement);
    expect(extract).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
});

it('discards a draft file picker result after the subtitle picker closes', async () => {
    await render();
    const signal = controller.fileRequestSignal({ forDraft: true });
    await act(async () => controller.closePicker());
    const files = [{ id: 'discarded', file: new File([], 'discarded.srt') }];
    expect(await controller.acceptFileRequest(files, [], { forDraft: true, signal })).toBeUndefined();
    expect(session.saveDraftHandlesToSession).not.toHaveBeenCalled();
    expect(currentSources.subtitleSourceFiles).toEqual([]);
});

it('accepts fallback input changes only for the draft that opened the input', async () => {
    await render();
    controller.fileRequestSignal({ forDraft: true });
    expect(controller.draftFileInputIsCurrent()).toBe(false);

    controller.beginDraftFileInputRequest();
    expect(controller.draftFileInputIsCurrent()).toBe(true);

    await act(async () => controller.closePicker());
    expect(controller.draftFileInputIsCurrent()).toBe(false);
});

it('accepts a standalone file request after the subtitle picker changes', async () => {
    await render();
    const signal = controller.fileRequestSignal({ forDraft: false });
    const file = { id: 'external', file: new File([srt], 'external.srt') };
    await act(async () => {
        controller.resetPickerDraft();
        expect(await controller.acceptFileRequest([file], [], { forDraft: false, signal })).toEqual([file]);
    });
    expect(currentSources.subtitleSourceFiles).toEqual([{ ...file, track: 0 }]);
    expect(onError).not.toHaveBeenCalled();
});

it.each([true, false])('restores cached=%s embedded subtitles and extracts only missing contents', async (cached) => {
    await render();
    const file = new File([srt], 'video.track1.en.srt', { type: 'application/x-subrip' });
    Object.defineProperty(file, 'text', { value: async () => srt });
    record = {
        id: 1,
        timestamp: 1,
        videoHandle: {
            id: video.id,
            handle: {
                name: video.file.name,
                getFile: async () => video.file,
                queryPermission: async () => 'granted',
            } as unknown as FileSystemFileHandle,
        },
        subtitleHandles: [],
        cachedSubtitleFiles: cached ? [{ id: choice.id, file }] : [],
        embeddedSubtitles: { [choice.id]: choice.embedded! },
        subtitleTrackIds: [[choice.id]],
    };
    await act(async () => controller.restoreSession());
    expect(picker.onManualFilesImported).not.toHaveBeenCalled();
    expect(currentSources.videoFile).toEqual(video);
    if (cached) {
        expect(subtitles?.map(({ text }) => text)).toEqual(['First']);
        expect(extract).not.toHaveBeenCalled();
        expect(picker.embedded.service.completedFile(video, 0)?.file).toBe(file);
    } else {
        expect(extract).toHaveBeenCalledTimes(1);
        expect(extraction.signal.aborted).toBe(false);
        await act(async () => {
            emit(srt);
            finish([{ trackKey: 0, format: 'srt', blob: new Blob([srt]) }]);
        });
        expect(subtitles?.map(({ text }) => text)).toEqual(['First']);
        expect(onCompleted).toHaveBeenCalledTimes(1);
        expect(session.saveSubtitleSelection).toHaveBeenCalledWith(onCompleted.mock.calls[0][1], new Set());
    }
    expect(onError).not.toHaveBeenCalled();
});
