import { afterAll, afterEach, beforeAll, beforeEach, expect, it, jest } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { TextDecoder } from 'util';
import { SubtitleHtml } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import type { SubtitleHost } from '@project/common/embedded-subtitles/subtitle-source';
import { mkv, mkvTrack } from '@project/common/media-probe/test-media';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { useMediaSources } from '@project/common/app/hooks/use-media-sources';

jest.mock('react-i18next', () => {
    const makeT =
        (prefix: string) =>
        (key: string, options?: { trackNumber?: number; format?: string; message?: string; extension?: string }) => {
            if (key === 'settings.subtitleTrackChoice') return `Track ${options?.trackNumber}`;
            if (key === 'error.unsupportedFormat') return `Unsupported ${options?.format}`;
            if (key === 'error.unsupportedExtension') return `Unsupported extension ${options?.extension}`;
            if (key === 'info.error') return `Error: ${options?.message}`;
            return `${prefix}${key}`;
        };
    let currentT = makeT('');
    return {
        useTranslation: () => ({ t: currentT }),
        __setLanguagePrefix: (prefix: string) => {
            currentT = makeT(prefix);
        },
    };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
    URL.createObjectURL = jest.fn(() => `blob:hook-${++nextBlobUrl}`);
    URL.revokeObjectURL = jest.fn();
});

afterAll(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
});

const reader = new SubtitleReader({
    regexFilter: '',
    regexFilterTextReplacement: '',
    subtitleHtml: SubtitleHtml.render,
    convertNetflixRuby: false,
    pgsParserWorkerFactory: async () => {
        throw new Error('Text source');
    },
});

const host: SubtitleHost = {
    extractSubtitles: jest.fn(async () => []),
};

let latest!: ReturnType<typeof useMediaSources>;
let container: HTMLDivElement;
let root: Root;

function Harness({ onError }: { onError: (error: unknown) => void }) {
    latest = useMediaSources({
        subtitleHost: host,
        subtitleReader: reader,
        onSourcesApplied: () => {},
        onError,
    });
    return null;
}

const makeVideo = (id: string, ...codecs: string[]): FileWithId => {
    const bytes = Uint8Array.from(mkv(mkvTrack(1, 'V_VP8'), ...codecs.map((codec) => mkvTrack(17, codec)))).buffer;
    const file = new File(['video'], `${id}.mkv`, { lastModified: 1 });
    Object.defineProperty(file, 'size', { value: bytes.byteLength });
    file.slice = () => ({ arrayBuffer: async () => bytes }) as Blob;
    return { id, file };
};

beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
});

it('formats supported and unsupported embedded tracks, preserves controller identity across renders, and deduplicates picker track edits', async () => {
    const onError1 = jest.fn();
    const onError2 = jest.fn();
    await act(async () => root.render(<Harness onError={onError1} />));
    const initialController = latest.controller;

    await act(async () => root.render(<Harness onError={onError2} />));
    expect(latest.controller).toBe(initialController);

    const video = makeVideo('episode', 'S_TEXT/UTF8', 'S_HDMV/PGS');
    await act(async () => {
        latest.controller.importManualFiles([video]);
    });
    expect(latest.picker.open).toBe(true);
    expect(latest.picker.tracks.map(({ label, disabledReason }) => ({ label, disabledReason }))).toEqual([
        { label: 'extension.videoDataSync.emptySubtitleTrack', disabledReason: undefined },
        { label: 'English · SRT · Track 1', disabledReason: undefined },
        { label: 'English · PGS · Track 2', disabledReason: 'Unsupported PGS' },
    ]);

    const online = {
        id: 'https://example.test/sub.srt',
        url: 'https://example.test/sub.srt',
        label: 'sub.srt',
        extension: 'srt',
    };
    await act(async () => {
        latest.controller.setPickerTracks([...latest.picker.tracks, online]);
    });
    expect(latest.picker.tracks.map(({ id }) => id)).toEqual([
        '-',
        online.id,
        latest.picker.tracks[2].id,
        latest.picker.tracks[3].id,
    ]);
    expect(latest.picker.tracks).toHaveLength(4);
});

it('formats embedded vs selection errors separately', async () => {
    await act(async () => root.render(<Harness onError={jest.fn()} />));

    const broken = { id: 'broken', file: new File(['bad'], 'broken.mkv') };
    Object.defineProperty(broken.file, 'size', { value: 4 });
    broken.file.slice = () => ({ arrayBuffer: async () => Promise.reject(new Error('IO failure')) }) as Blob;

    await act(async () => {
        latest.controller.importManualFiles([broken]);
    });
    expect(latest.picker.errorMessage).toBe('error.embeddedSubtitlesLoadFailed');

    await act(async () => {
        latest.controller.openPicker();
        latest.controller.setPickerSelectedTrackIds(['different']);
        latest.controller.confirm([{ id: 'stale', label: 'stale', name: 'stale', extension: 'srt' }]);
    });
    expect(latest.picker.errorMessage).toBe('Error: Subtitle selection has changed');

    const badFile = new File(['hello'], 'notes.txt');
    await act(async () => {
        latest.controller.setPickerTracks([{ id: 'bad', label: 'notes.txt', extension: 'txt', file: badFile }]);
        latest.controller.setPickerSelectedTrackIds(['bad']);
        latest.controller.confirm([
            { id: 'bad', label: 'notes.txt', name: 'notes.txt', extension: 'txt', file: badFile },
        ]);
    });
    expect(latest.picker.errorMessage).toBe('Unsupported extension txt');
});

it('keeps subtitleProducer stable when UI language changes', async () => {
    const i18n = jest.requireMock<{ __setLanguagePrefix: (prefix: string) => void }>('react-i18next');
    await act(async () => root.render(<Harness onError={jest.fn()} />));
    const video = makeVideo('lang', 'S_TEXT/UTF8');
    await act(async () => {
        latest.controller.importManualFiles([video]);
    });
    const embeddedTrack = latest.picker.tracks.find((track) => track.embedded)!;
    await act(async () => {
        latest.controller.setPickerSelectedTrackIds([embeddedTrack.id]);
        latest.controller.confirm([{ ...embeddedTrack, name: 'track.srt' }]);
    });
    const firstProducer = latest.subtitleProducer;
    expect(firstProducer).toBeDefined();

    i18n.__setLanguagePrefix('ja:');
    await act(async () => root.render(<Harness onError={jest.fn()} />));
    expect(latest.subtitleProducer).toBe(firstProducer);
    i18n.__setLanguagePrefix('');
});
