import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';
import { SubtitleHtml } from '@project/common';
import type { ConfirmedVideoDataSubtitleTrack, DisplaySubtitleModel } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { FileSessionRecord } from '@project/common/file-system-access';
import type { FileSessionStore } from '@project/common/app/services/file-session';
import { MediaSourcesController } from '@project/common/app/services/media-sources-controller';
import type { EmbeddedSelection } from '@project/common/app/services/media-sources-controller';
import { SubtitleTracksController } from '@project/common/app/services/subtitle-tracks-controller';
import { TestVideoProtocol } from '@project/common/app/services/subtitle-tracks-test-utils';
import VideoChannel from '@project/common/app/services/video-channel';
import { embeddedDescriptor, embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import type {
    ExtractedSubtitleFile,
    SubtitleExtractionOptions,
} from '@project/common/embedded-subtitles/subtitle-source';
import { mkv, mkvTrack } from '@project/common/media-probe/test-media';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { subtitleKey } from '@project/common/subtitle-reader/subtitle-stream';

const encoder = new TextEncoder();
const srt = '1\n00:00:01,000 --> 00:00:02,000\nFirst\n\n';
const originalText = Object.getOwnPropertyDescriptor(Blob.prototype, 'text');
const originalFetch = globalThis.fetch;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

let nextBlobUrl = 0;

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
    URL.createObjectURL = jest.fn(() => `blob:test-${++nextBlobUrl}`);
    URL.revokeObjectURL = jest.fn();
});

afterAll(() => {
    if (originalText) Object.defineProperty(Blob.prototype, 'text', originalText);
    else Reflect.deleteProperty(Blob.prototype, 'text');
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const reader = new SubtitleReader({
    regexFilter: '',
    regexFilterTextReplacement: '',
    subtitleHtml: SubtitleHtml.render,
    convertNetflixRuby: false,
    pgsParserWorkerFactory: async () => {
        throw new Error('Text source');
    },
});

const subtitle = (id: string): FileWithId => ({ id, file: new File([''], `${id}.srt`) });

interface DeferredRead {
    finish: () => void;
    reject: (error: Error) => void;
}

const deferredVideo = (reads: DeferredRead[], id: string, codec: string | undefined = 'S_TEXT/UTF8'): FileWithId => {
    const bytes = mkv(mkvTrack(1, 'V_VP8'), ...(codec ? [mkvTrack(17, codec)] : []));
    const file = new File(['video'], `${id}.mkv`, { lastModified: 1 });
    Object.defineProperty(file, 'size', { value: bytes.length });
    file.slice = () =>
        ({
            arrayBuffer: () =>
                new Promise<ArrayBuffer>((resolve, reject) =>
                    reads.push({ finish: () => resolve(Uint8Array.from(bytes).buffer), reject })
                ),
        }) as Blob;
    return { id, file };
};

const immediateVideo = (id = 'video'): FileWithId => {
    const bytes = Uint8Array.from(mkv(mkvTrack(1, 'V_VP8'), mkvTrack(17, 'S_TEXT/UTF8'))).buffer;
    const file = new File([], `${id}.mkv`, { lastModified: 1 });
    Object.defineProperty(file, 'size', { value: bytes.byteLength });
    file.slice = () => ({ arrayBuffer: async () => bytes }) as Blob;
    return { id, file };
};

const embeddedChoice = (source: FileWithId): ConfirmedVideoDataSubtitleTrack => ({
    id: embeddedSubtitleId(source.id, 0),
    embedded: embeddedDescriptor(source, { trackIndex: 0, codec: 'subrip' }),
    label: 'English',
    name: 'English',
    extension: 'srt',
});

let controller: MediaSourcesController;
let tracksController: SubtitleTracksController | undefined;
let disconnectChannel: (() => void) | undefined;
let subtitles: DisplaySubtitleModel[] | undefined;
let extraction: SubtitleExtractionOptions;
let finishExtraction: (files: ExtractedSubtitleFile[]) => void;
let record: FileSessionRecord | undefined;
let session: jest.Mocked<FileSessionStore>;
let video: FileWithId;
let choice: ConfirmedVideoDataSubtitleTrack;
let protocol: TestVideoProtocol;
const onError = jest.fn<(error: unknown) => void>();
const extract = jest.fn<(options: SubtitleExtractionOptions) => Promise<ExtractedSubtitleFile[]>>();

const createController = (sessionStore: FileSessionStore | undefined = session) => {
    controller = new MediaSourcesController({
        subtitleHost: { extractSubtitles: extract },
        sessionStore,
        onError,
    });
    return controller;
};

/** Mirrors App + Player connecting MediaSourcesController's sources/producer to SubtitleTracksController. */
const attachTracksController = () => {
    subtitles = undefined;
    protocol = new TestVideoProtocol();
    const channel = new VideoChannel(protocol);
    let activeSelection: EmbeddedSelection | undefined;
    let activeTracks: unknown;
    const makeSource = () => {
        const { embeddedSelection, sources } = controller.getState();
        const producer = controller.createProducer(embeddedSelection, {
            reader,
            errorMessage: () => 'Failed to load embedded subtitles',
        });
        return producer
            ? { kind: 'producer' as const, producer, supportsProgressiveSubtitles: true, onInitialized: () => {} }
            : { kind: 'local' as const, tracks: sources.subtitleTracks, reader, onInitialized: () => {} };
    };
    tracksController = new SubtitleTracksController(
        {
            source: makeSource(),
            subtitles,
            channel,
            getSubtitleOffset: () => 0,
            shouldRestoreSubtitles: async () => true,
            onSubtitles: (update) => {
                subtitles = update(subtitles);
                if (tracksController) tracksController.options.subtitles = subtitles;
            },
            onError,
        },
        () => {}
    );
    disconnectChannel = tracksController.connect(channel);
    const sync = () => {
        const { embeddedSelection, sources } = controller.getState();
        if (embeddedSelection === activeSelection && (embeddedSelection || sources.subtitleTracks === activeTracks)) {
            return;
        }
        activeSelection = embeddedSelection;
        activeTracks = sources.subtitleTracks;
        tracksController?.setSource(makeSource());
    };
    sync();
    return controller.subscribe(sync);
};

const emit = (text: string) => extraction.onChunk(0, encoder.encode(text).buffer);

const openAndConfirm = async (tracks: ConfirmedVideoDataSubtitleTrack[], selectedTrackIds?: string[]) => {
    if (!controller.getState().picker.open) controller.openPicker();
    controller.setPickerSelectedTrackIds(selectedTrackIds ?? tracks.map(({ id }) => id));
    controller.confirm(tracks);
    await flush();
};

beforeEach(() => {
    onError.mockClear();
    extract.mockReset().mockImplementation((options) => {
        extraction = options;
        return new Promise((resolve, reject) => {
            finishExtraction = resolve;
            options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        });
    });
    record = undefined;
    video = immediateVideo();
    choice = embeddedChoice(video);
    session = {
        fetch: jest.fn(async () => record),
        merge: jest.fn(async () => {}),
        retain: jest.fn(async () => {}),
        promoteBuffered: jest.fn(async () => {}),
        promoteBufferedVideo: jest.fn(async () => false),
        clearBuffered: jest.fn(async () => {}),
        setCachedSubtitleFiles: jest.fn(async () => true),
        clear: jest.fn(async () => {}),
    };
    tracksController = undefined;
    disconnectChannel = undefined;
    subtitles = undefined;
    createController();
});

afterEach(() => {
    disconnectChannel?.();
    tracksController?.cancelSource();
    controller.dispose();
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
});

// --- Discovery & picker policy ---

it.each([0, 1, 2])('automatically opens only for multiple external subtitles (%i files)', async (count) => {
    const files = Array.from({ length: count }, (_, index) => subtitle(String(index)));
    controller.importManualFiles(files);
    await flush();
    expect(controller.getState().picker.open).toBe(count > 1);
    if (count > 1) expect(controller.getState().picker.selectedTrackIds).toEqual(['0', '1', '-']);
    expect(extract).not.toHaveBeenCalled();
});

it('opens a video-only import after supported embedded tracks are discovered', async () => {
    const reads: DeferredRead[] = [];
    controller.importManualFiles([deferredVideo(reads, 'episode')]);
    expect(controller.getState().picker.open).toBe(false);
    expect(controller.getState().picker.discovering).toBe(true);
    reads[0].finish();
    await flush();
    expect(controller.getState().picker.open).toBe(true);
    expect(controller.getState().picker.discovering).toBe(false);
    expect(controller.getState().picker.embeddedTracks?.map((track) => track.trackIndex)).toEqual([0]);
    expect(extract).not.toHaveBeenCalled();
});

it.each(['S_HDMV/PGS', 'S_VOBSUB', 'S_DVBSUB'])(
    'automatically opens for supported embedded bitmap tracks (%s)',
    async (codec) => {
        const reads: DeferredRead[] = [];
        controller.importManualFiles([deferredVideo(reads, 'episode', codec)]);
        reads[0].finish();
        await flush();
        expect(controller.getState().picker.open).toBe(true);
        expect(controller.getState().picker.embeddedTracks?.[0].outputFormat).toBe('asbimg');
        expect(extract).not.toHaveBeenCalled();
    }
);

it.each(['S_TEXT/UNKNOWN', ''])(
    'does not automatically open for unsupported or absent embedded tracks (%s)',
    async (codec) => {
        const reads: DeferredRead[] = [];
        controller.importManualFiles([deferredVideo(reads, 'episode', codec)]);
        reads[0].finish();
        await flush();
        expect(controller.getState().picker.open).toBe(false);
        if (codec) {
            controller.openPicker();
            await flush();
            expect(controller.getState().picker.open).toBe(true);
            const embeddedTracks = controller.getState().picker.embeddedTracks;
            expect(embeddedTracks).toEqual([
                expect.objectContaining({
                    trackIndex: 0,
                    codec,
                }),
            ]);
            expect(embeddedTracks![0].outputFormat).toBeUndefined();
            expect(reads).toHaveLength(1);
        }
        expect(extract).not.toHaveBeenCalled();
    }
);

it('retains external subtitles without automatic discovery, but still allows explicitly opening the picker', async () => {
    const reads: DeferredRead[] = [];
    controller.loadSourceFiles([subtitle('en')]);
    controller.importManualFiles([deferredVideo(reads, 'episode')]);
    await flush();
    expect(controller.getState().picker.open).toBe(false);
    expect(reads).toHaveLength(0);

    controller.openPicker();
    reads[0].finish();
    await flush();
    expect(controller.getState().picker.open).toBe(true);
    expect(controller.getState().picker.selectedTrackIds).toEqual(['en', '-', '-']);
    expect(controller.getState().picker.externalTracks.map((track) => track.label)).toEqual(['en.srt']);
    expect(controller.getState().picker.embeddedTracks).toHaveLength(1);
    expect(extract).not.toHaveBeenCalled();
});

it('does not reopen after cancellation, ignores late reads, and rediscovers on explicit open', async () => {
    const reads: DeferredRead[] = [];
    controller.importManualFiles([deferredVideo(reads, 'episode')]);
    controller.closePicker();
    reads[0].finish();
    await flush();
    expect(controller.getState().picker.open).toBe(false);
    expect(controller.getState().picker.embeddedTracks).toBeUndefined();

    controller.openPicker();
    reads[1].finish();
    await flush();
    expect(controller.getState().picker.open).toBe(true);
    expect(controller.getState().picker.embeddedTracks).toHaveLength(1);
    expect(extract).not.toHaveBeenCalled();
});

it.each([false, true])('ignores cancelled discovery for a replacement import (same file: %s)', async (sameFile) => {
    const reads: DeferredRead[] = [];
    const original = deferredVideo(reads, 'old');
    controller.importManualFiles([original]);
    controller.importManualFiles([sameFile ? original : deferredVideo(reads, 'replacement')]);
    reads[0].finish();
    await flush();
    expect(controller.getState().picker.open).toBe(false);
    reads[1].finish();
    await flush();
    expect(controller.getState().picker.open).toBe(true);
    expect(extract).not.toHaveBeenCalled();
});

it.each([0, 1, 2])(
    'defers selection of %i incoming subtitle files while the replacement video loads',
    async (count) => {
        const reads: DeferredRead[] = [];
        const files = Array.from({ length: count }, (_, index) => subtitle(`new-${index}`));
        controller.loadSourceFiles([deferredVideo(reads, 'old'), subtitle('old')]);
        controller.openPicker();
        controller.stagePickerFiles([deferredVideo(reads, 'replacement'), ...files]);
        expect(controller.getState().picker.open).toBe(true);
        const expectedFiles = count > 0 ? files : [subtitle('old')];
        expect(controller.getState().picker.selectedTrackIds).toEqual(
            [0, 1, 2].map((index) => expectedFiles[index]?.id ?? '-')
        );
        reads[0].finish();
        await flush();
        expect(controller.getState().picker.embeddedTracks).toBeUndefined();
        reads[1].finish();
        await flush();
        expect(controller.getState().picker.externalTracks.map((track) => track.label)).toEqual(
            expectedFiles.map(({ file }) => file.name)
        );
        expect(controller.getState().picker.embeddedTracks).toHaveLength(1);
        expect(extract).not.toHaveBeenCalled();
    }
);

it('reapplies cached embedded choices when reimporting the active video with different subtitle files', async () => {
    const reads: DeferredRead[] = [];
    const active = deferredVideo(reads, 'active');
    controller.loadSourceFiles([active, subtitle('old')]);
    controller.openPicker();
    reads[0].finish();
    await flush();

    controller.stagePickerFiles([active, subtitle('new')]);
    await flush();
    expect(controller.getState().picker.selectedTrackIds).toEqual(['new', '-', '-']);
    expect(controller.getState().picker.externalTracks.map((track) => track.label)).toEqual(['new.srt']);
    expect(controller.getState().picker.embeddedTracks).toHaveLength(1);
    expect(reads).toHaveLength(1);
    expect(extract).not.toHaveBeenCalled();
});

it('does not reopen if an external subtitle arrives during discovery', async () => {
    const reads: DeferredRead[] = [];
    controller.importManualFiles([deferredVideo(reads, 'episode')]);
    controller.importManualFiles([subtitle('en')]);
    reads[0].finish();
    await flush();
    expect(controller.getState().picker.open).toBe(false);
    expect(extract).not.toHaveBeenCalled();
});

it('reports failed discovery and retries on explicit open or new video without loading FFmpeg', async () => {
    const reads: DeferredRead[] = [];
    controller.importManualFiles([deferredVideo(reads, 'failed')]);
    reads[0].reject(new Error('File read failed'));
    await flush();
    expect(controller.getState().picker.open).toBe(false);
    expect(controller.getState().picker.discoveryError).toBe(true);

    controller.openPicker();
    expect(controller.getState().picker.discoveryError).toBe(false);
    reads[1].reject(new Error('Still failing'));
    await flush();
    expect(controller.getState().picker.discoveryError).toBe(true);

    controller.importManualFiles([deferredVideo(reads, 'replacement')]);
    reads[2].finish();
    await flush();
    expect(controller.getState().picker.open).toBe(true);
    expect(controller.getState().picker.discoveryError).toBe(false);
    expect(extract).not.toHaveBeenCalled();
});

// --- Selection resolution & confirmation ---

it('resolves mixed sources and keeps duplicate downloads in separate slots', async () => {
    const download = jest.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['downloaded']),
    } as Response);
    globalThis.fetch = download;
    const online = {
        id: 'online',
        url: 'https://example.test/subtitles',
        extension: 'srt',
        label: 'Online',
        name: 'Online',
    };
    const local = {
        id: 'local',
        file: new File(['local'], 'local.srt'),
        extension: 'srt',
        label: 'Local',
        name: 'Local',
    };
    const empty = { id: '-', extension: 'srt', label: '-', name: '-' };

    controller.loadSourceFiles([video]);
    await openAndConfirm([choice, online, local]);
    expect(controller.getState().sources.subtitleTracks.map(({ fileParts }) => fileParts[0].id)).toEqual([
        choice.id,
        'online',
        'local',
    ]);
    expect(controller.getState().sources.subtitleTracks[0].fileParts[0].file.size).toBe(0);
    expect(controller.getState().sources.subtitleTracks[2].fileParts[0].file).toBe(local.file);
    expect(download.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);

    download.mockClear();
    await openAndConfirm([empty, online, online]);
    const tracks = controller.getState().sources.subtitleTracks;
    expect(tracks.map(({ fileParts }) => fileParts[0].id)).toEqual(['-', 'online', 'online']);
    expect(tracks[1].fileParts[0].file).toBe(tracks[2].fileParts[0].file);
    expect(download).toHaveBeenCalledTimes(1);
    expect(extract).not.toHaveBeenCalled();
});

it('does not commit a partial selection after a failed download and allows retry', async () => {
    globalThis.fetch = jest
        .fn<typeof fetch>()
        .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
        .mockResolvedValue({ ok: true, blob: async () => new Blob(['downloaded']) } as Response);
    const online = {
        id: 'online',
        url: 'https://example.test/subtitles',
        extension: 'srt',
        label: 'Online',
        name: 'Online',
    };
    const empty = { id: '-', extension: 'srt', label: '-', name: '-' };

    await openAndConfirm([empty, online]);
    expect(controller.getState().picker.open).toBe(true);
    expect(controller.getState().picker.confirming).toBe(false);
    expect(controller.getState().picker.selectionError).toEqual({ kind: 'selection', error: new Error('HTTP 500') });
    expect(controller.getState().sources.subtitleTracks).toEqual([]);

    controller.confirm([empty, online]);
    await flush();
    expect(controller.getState().picker.open).toBe(false);
    expect(controller.getState().picker.selectionError).toBeUndefined();
    expect(controller.getState().sources.subtitleTracks.map(({ fileParts }) => fileParts[0].id)).toEqual([
        '-',
        'online',
    ]);
    expect(extract).not.toHaveBeenCalled();
});

it('ignores a download that finishes after the picker closes', async () => {
    let finishDownload!: (response: Response) => void;
    const download = jest.fn<typeof fetch>(
        () =>
            new Promise((resolve) => {
                finishDownload = resolve;
            })
    );
    globalThis.fetch = download;
    const online = {
        id: 'online',
        url: 'https://example.test/subtitles',
        extension: 'srt',
        label: 'Online',
        name: 'Online',
    };

    controller.openPicker();
    controller.setPickerSelectedTrackIds(['online']);
    controller.confirm([online]);
    expect(controller.getState().picker.confirming).toBe(true);

    controller.closePicker();
    expect(download.mock.calls[0][1]?.signal?.aborted).toBe(true);
    finishDownload({ ok: true, blob: async () => new Blob(['late']) } as Response);
    await flush();
    expect(controller.getState().picker.confirming).toBe(false);
    expect(controller.getState().picker.selectionError).toBeUndefined();
    expect(controller.getState().sources.subtitleTracks).toEqual([]);
});

it('commits resolved slots together and preserves every part of existing subtitle tracks', async () => {
    const first = { id: 'first', file: new File(['first'], 'first.srt') };
    const second = { id: 'second', file: new File(['second'], 'second.srt') };
    controller.loadSourceFiles([
        { ...first, track: 0 },
        { ...second, track: 0 },
    ]);
    const local = { ...first, name: 'first', label: 'first', extension: 'srt' };
    const empty = { id: '-', name: '-', label: '-', extension: 'srt' };
    await openAndConfirm([local, empty, local]);
    const tracks = controller.getState().sources.subtitleTracks;
    expect(tracks[0].fileParts.map(({ id }) => id)).toEqual(['first', 'second']);
    expect(tracks[1].fileParts.map(({ id }) => id)).toEqual(['-']);
    expect(tracks[2].fileParts.map(({ id }) => id)).toEqual(['first', 'second']);
    expect(extract).not.toHaveBeenCalled();
});

it('ignores duplicate confirmation while confirming and aborts pending confirmation on cancel, replace, or dispose', async () => {
    const online = {
        id: 'online',
        url: 'https://example.test/subtitles',
        extension: 'srt',
        label: 'Online',
        name: 'Online',
    };
    for (const action of ['cancel', 'replace', 'dispose'] as const) {
        let releaseFetch!: (value: Response) => void;
        const download = jest.fn<typeof fetch>(
            () =>
                new Promise((resolve) => {
                    releaseFetch = resolve;
                })
        );
        globalThis.fetch = download;
        createController();
        controller.loadSourceFiles([video]);
        controller.openPicker();
        controller.setPickerSelectedTrackIds([online.id]);
        controller.confirm([online]);
        controller.confirm([online]);
        await flush();
        expect(download).toHaveBeenCalledTimes(1);
        expect(controller.getState().picker.confirming).toBe(true);

        if (action === 'cancel') controller.closePicker();
        else if (action === 'replace') controller.loadSourceFiles([immediateVideo('replacement')]);
        else controller.dispose();

        releaseFetch({ ok: true, blob: async () => new Blob([srt]) } as Response);
        await flush();
        expect(controller.getState().embeddedSelection).toBeUndefined();
        expect(extract).not.toHaveBeenCalled();
        if (action !== 'dispose') expect(controller.getState().picker.selectionError).toBeUndefined();
    }
});

it('rejects stale choices and confirms without waiting on a pending session read', async () => {
    controller.loadSourceFiles([video]);
    await openAndConfirm([choice], ['different']);
    expect(controller.getState().picker.selectionError).toEqual({
        kind: 'selection',
        error: new Error('Subtitle selection has changed'),
    });
    expect(controller.getState().embeddedSelection).toBeUndefined();

    session.fetch.mockImplementationOnce(() => new Promise(() => {}));
    controller.setPickerSelectedTrackIds([choice.id]);
    expect(controller.getState().picker.selectionError).toBeUndefined();
    controller.confirm([choice]);
    await flush();
    expect(controller.getState().picker.open).toBe(false);
    expect(controller.getState().picker.confirming).toBe(false);
    expect(controller.getState().embeddedSelection?.pendingDescriptors).toEqual([choice.embedded]);
    expect(extract).not.toHaveBeenCalled();
});

// --- Extraction, persistence, unload, draft requests, and session restore ---

it('reselects a completed embedded subtitle as a standalone file and saves it after unload', async () => {
    controller.loadSourceFiles([video]);
    attachTracksController();
    await openAndConfirm([choice]);
    finishExtraction([{ trackKey: 0, format: 'srt', blob: new Blob([srt]) }]);
    await flush();
    const extracted = controller.getState().sources.subtitleSourceFiles[0];
    expect(extracted.embedded).toBeDefined();

    expect(controller.unloadVideo(controller.getState().sources.videoFileUrl!)).toBe(true);
    expect(controller.getState().sources.videoFile).toBeUndefined();
    const retained = controller.getState().sources.firstSubtitleSourceFiles[0]!;
    await openAndConfirm([{ ...choice, file: retained.file, embedded: retained.embedded }]);

    expect(session.setCachedSubtitleFiles).toHaveBeenLastCalledWith(
        [{ id: extracted.id, file: extracted.file, track: 0 }],
        { subtitleTrackIds: [[extracted.id]], embeddedSubtitles: {} }
    );
    expect(extract).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
});

it('starts extraction while session storage is busy and saves completed bytes last', async () => {
    controller.loadSourceFiles([video]);
    attachTracksController();
    let promote!: () => void;
    session.promoteBuffered.mockImplementationOnce(() => new Promise((resolve) => (promote = resolve)));

    await openAndConfirm([choice]);
    expect(controller.getState().picker.open).toBe(false);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(session.setCachedSubtitleFiles).not.toHaveBeenCalled();

    controller.closePicker();
    const file = new Blob([srt], { type: 'application/x-subrip' });
    finishExtraction([{ trackKey: 0, format: 'srt', blob: file }]);
    await flush();
    expect(controller.getState().sources.canDownloadSubtitles).toBe(true);
    expect(session.setCachedSubtitleFiles).not.toHaveBeenCalled();

    promote();
    await flush();
    const lastSavedFiles = session.setCachedSubtitleFiles.mock.calls.at(-1)![0];
    expect(lastSavedFiles[0].file.size).toBe(file.size);
});

it('saves only the latest selection when a second confirmation overtakes a pending session write', async () => {
    controller.loadSourceFiles([video]);
    attachTracksController();
    let promote!: () => void;
    session.promoteBuffered
        .mockImplementationOnce(() => new Promise((resolve) => (promote = resolve)))
        .mockResolvedValue(undefined);
    await openAndConfirm([choice]);
    expect(extract).toHaveBeenCalledTimes(1);

    const local = { id: 'local', file: new File([srt], 'local.srt') };
    await openAndConfirm([{ ...local, name: 'local', label: 'local.srt', extension: 'srt' }]);
    expect(extraction.signal.aborted).toBe(true);

    promote();
    await flush();
    expect(session.setCachedSubtitleFiles).toHaveBeenCalledTimes(1);
    expect(session.setCachedSubtitleFiles).toHaveBeenCalledWith([local], {
        subtitleTrackIds: [['local']],
        embeddedSubtitles: {},
    });
});

it('hands confirmed extraction to the shared controller and persists completion without replacing cue identity or restarting', async () => {
    controller.loadSourceFiles([video]);
    attachTracksController();
    protocol.ready();
    await openAndConfirm([choice]);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(session.setCachedSubtitleFiles).toHaveBeenCalledWith([], {
        subtitleTrackIds: [[choice.id]],
        embeddedSubtitles: { [choice.id]: choice.embedded },
    });
    expect(controller.getState().sources.canDownloadSubtitles).toBe(false);

    emit(srt);
    await flush();
    expect(subtitles?.map(({ text }) => text)).toEqual(['First']);
    const keys = subtitles!.map(subtitleKey);
    // Closing the already-confirmed picker must not cancel the player's extraction.
    controller.closePicker();
    expect(extraction.signal.aborted).toBe(false);

    finishExtraction([{ trackKey: 0, format: 'srt', blob: new Blob([srt]) }]);
    await flush();
    expect(controller.getState().sources.canDownloadSubtitles).toBe(true);
    expect(subtitles!.map(subtitleKey)).toEqual(keys);
    expect(controller.getState().sources.subtitleSourceFiles[0].file.size).toBeGreaterThan(0);
    expect(await controller.getState().sources.subtitleSourceFiles[0].file.text()).toBe(srt);
    expect(session.setCachedSubtitleFiles).toHaveBeenLastCalledWith([expect.objectContaining({ id: choice.id })], {
        subtitleTrackIds: [[choice.id]],
        embeddedSubtitles: { [choice.id]: choice.embedded },
        expectedSelection: { videoId: video.id, subtitleTrackIds: [[choice.id]] },
    });
    protocol.ready();
    await flush();
    expect(subtitles!.map(subtitleKey)).toEqual(keys);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
});

it('keeps the extraction and published cues when confirming the same selection again', async () => {
    controller.loadSourceFiles([video]);
    attachTracksController();
    await openAndConfirm([choice]);
    emit(srt);
    await flush();
    const signal = extraction.signal;
    const keys = subtitles!.map(subtitleKey);
    expect(keys).toHaveLength(1);

    const empty = { id: '-', name: '', label: '', extension: 'srt' };
    await openAndConfirm([choice, empty]);
    expect(signal.aborted).toBe(false);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(subtitles!.map(subtitleKey)).toEqual(keys);

    finishExtraction([{ trackKey: 0, format: 'srt', blob: new Blob([srt]) }]);
    await flush();
    expect(controller.getState().sources.canDownloadSubtitles).toBe(true);
});

it('keeps the completed file when extraction finishes during another confirmation', async () => {
    controller.loadSourceFiles([video]);
    attachTracksController();
    await openAndConfirm([choice]);
    emit(srt);
    await flush();
    const online = {
        id: 'online',
        url: 'https://example.test/subtitles',
        extension: 'srt',
        label: 'Online',
        name: 'Online',
    };
    let resume!: (value: Response) => void;
    globalThis.fetch = jest.fn<typeof fetch>(
        () =>
            new Promise((resolve) => {
                resume = resolve;
            })
    );
    await openAndConfirm([choice, online]);
    expect(resume).toBeDefined();

    finishExtraction([{ trackKey: 0, format: 'srt', blob: new Blob([srt]) }]);
    await flush();
    const file = controller.getState().sources.subtitleSourceFiles[0].file;
    const secondSrt = '1\n00:00:03,000 --> 00:00:04,000\nSecond\n\n';
    resume({ ok: true, blob: async () => new Blob([secondSrt]) } as Response);
    for (let i = 0; i < 10 && (subtitles?.length ?? 0) < 2; i++) await flush();

    expect(extract).toHaveBeenCalledTimes(1);
    expect(controller.getState().sources.subtitleSourceFiles[0].file).toBe(file);
    expect(subtitles?.map(({ text }) => text)).toEqual(['First', 'Second']);
    expect(session.setCachedSubtitleFiles).toHaveBeenLastCalledWith(
        [expect.objectContaining({ file }), expect.objectContaining({ id: 'online' })],
        {
            subtitleTrackIds: [[choice.id], ['online']],
            embeddedSubtitles: { [choice.id]: choice.embedded },
        }
    );
});

it('aborts the real extraction on source replacement and rejects late chunks and completion', async () => {
    controller.loadSourceFiles([video]);
    attachTracksController();
    await openAndConfirm([choice]);
    emit(srt);
    await flush();
    const old = extraction;
    const replacement = { id: 'external', file: new File([], 'external.vtt') };
    Object.defineProperty(replacement.file, 'text', {
        value: async () => 'WEBVTT\n\n00:00:03.000 --> 00:00:04.000\nReplacement\n',
    });
    controller.loadSourceFiles([replacement]);
    await flush();

    expect(old.signal.aborted).toBe(true);
    expect(subtitles?.map(({ text }) => text)).toEqual(['Replacement']);
    expect(() => old.onChunk(0, encoder.encode(srt).buffer)).toThrow();
    finishExtraction([{ trackKey: 0, format: 'srt', blob: new Blob([srt]) }]);
    await flush();
    expect(subtitles?.map(({ text }) => text)).toEqual(['Replacement']);
    expect(session.setCachedSubtitleFiles).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
});

it('does not apply a restored session after another import supersedes it', async () => {
    let resolve!: (value: FileSessionRecord | undefined) => void;
    session.fetch.mockImplementationOnce(
        () =>
            new Promise((done) => {
                resolve = done;
            })
    );
    const restore = controller.restoreSession();
    const replacement = { id: 'other-video', file: new File([], 'other.mkv') };
    controller.loadSourceFiles([replacement]);
    resolve({
        id: 1,
        timestamp: 1,
        videoHandle: { id: video.id, handle: {} as FileSystemFileHandle },
        subtitleHandles: [],
    });
    await restore;
    expect(controller.getState().sources.videoFile).toBe(replacement);
    expect(extract).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
});

it('discards a draft file picker result after the subtitle picker closes', async () => {
    controller.openPicker();
    const signal = controller.fileRequestSignal({ forDraft: true });
    controller.closePicker();
    const files = [{ id: 'discarded', file: new File([], 'discarded.srt') }];
    expect(await controller.acceptFileRequest(files, [], { forDraft: true, signal })).toBeUndefined();
    expect(session.merge).not.toHaveBeenCalled();
    expect(controller.getState().sources.subtitleSourceFiles).toEqual([]);
});

it('accepts fallback input changes only for the draft that opened the input', async () => {
    controller.openPicker();
    controller.fileRequestSignal({ forDraft: true });
    expect(controller.draftFileInputIsCurrent()).toBe(false);

    controller.beginDraftFileInputRequest();
    expect(controller.draftFileInputIsCurrent()).toBe(true);

    controller.closePicker();
    expect(controller.draftFileInputIsCurrent()).toBe(false);
});

it('accepts a standalone file request after the subtitle picker changes', async () => {
    const signal = controller.fileRequestSignal({ forDraft: false });
    const file = { id: 'external', file: new File([srt], 'external.srt') };
    controller.openPicker();
    controller.closePicker();
    expect(await controller.acceptFileRequest([file], [], { forDraft: false, signal })).toEqual([file]);
    expect(controller.getState().sources.subtitleSourceFiles).toEqual([{ ...file, track: 0 }]);
    expect(onError).not.toHaveBeenCalled();
});

it.each([true, false])('restores cached=%s embedded subtitles and extracts only missing contents', async (cached) => {
    attachTracksController();
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
    await controller.restoreSession();
    await flush();
    expect(controller.getState().picker.open).toBe(false);
    expect(controller.getState().sources.videoFile).toEqual(video);
    if (cached) {
        expect(subtitles?.map(({ text }) => text)).toEqual(['First']);
        expect(extract).not.toHaveBeenCalled();
    } else {
        expect(extract).toHaveBeenCalledTimes(1);
        expect(extraction.signal.aborted).toBe(false);
        emit(srt);
        finishExtraction([{ trackKey: 0, format: 'srt', blob: new Blob([srt]) }]);
        await flush();
        expect(subtitles?.map(({ text }) => text)).toEqual(['First']);
        expect(session.setCachedSubtitleFiles).toHaveBeenCalledWith([expect.objectContaining({ id: choice.id })], {
            subtitleTrackIds: [[choice.id]],
            embeddedSubtitles: { [choice.id]: choice.embedded },
            expectedSelection: { videoId: video.id, subtitleTrackIds: [[choice.id]] },
        });
    }
    expect(onError).not.toHaveBeenCalled();
});
