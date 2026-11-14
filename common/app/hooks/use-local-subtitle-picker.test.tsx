import { afterEach, beforeAll, beforeEach, expect, it, jest } from '@jest/globals';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { TextDecoder } from 'util';
import type { FileWithId } from '@project/common/file-selector';
import type { SubtitleHost } from '@project/common/embedded-subtitles/subtitle-source';
import { mkv, mkvTrack } from '@project/common/media-probe/test-media';
import { useLocalSubtitlePicker } from '@project/common/app/hooks/use-local-subtitle-picker';

jest.mock('react-i18next', () => {
    const t = (key: string, options?: { trackNumber?: number; format?: string }) => {
        if (key === 'settings.subtitleTrackChoice') return `Track ${options?.trackNumber}`;
        if (key === 'error.unsupportedFormat') return `Unsupported ${options?.format}`;
        return key;
    };
    return { useTranslation: () => ({ t }) };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.assign(globalThis, { TextDecoder });

const host: SubtitleHost = {
    extractSubtitles: jest.fn(() => {
        throw new Error('Opening the picker must not load FFmpeg');
    }),
};

const subtitle = (id: string): FileWithId => ({ id, file: new File([''], `${id}.srt`) });

let ioGeneration = 0;
let reads: { finish: () => void; reject: (error: Error) => void }[];

const video = (id: string, codec: string | undefined = 'S_TEXT/UTF8', audioCodecs: string[] = []): FileWithId => {
    const bytes = mkv(
        mkvTrack(1, 'V_VP8'),
        ...(codec ? [mkvTrack(17, codec)] : []),
        ...audioCodecs.map((codec) => mkvTrack(2, codec))
    );
    const file = new File(['video'], `${id}.mkv`);
    Object.defineProperty(file, 'size', { value: bytes.length });
    // Delay file I/O, but exercise the real metadata reader, discovery service and picker state.
    let pending: { generation: number; promise: Promise<ArrayBuffer> } | undefined;
    file.slice = () =>
        ({
            arrayBuffer: () => {
                // Concurrent audio and subtitle readers share the delayed I/O for this user action.
                if (pending?.generation === ioGeneration) return pending.promise;
                const promise = new Promise<ArrayBuffer>((resolve, reject) =>
                    reads.push({ finish: () => resolve(Uint8Array.from(bytes).buffer), reject })
                );
                pending = { generation: ioGeneration, promise };
                return promise;
            },
        }) as Blob;
    return { id, file };
};

interface Import {
    video?: FileWithId;
    files: FileWithId[];
}

function Harness({ incoming, restored }: { incoming: Import; restored?: Import }) {
    const [source, setSource] = useState(restored?.video);
    const [files, setFiles] = useState<FileWithId[]>(restored?.files ?? []);
    const [discoveryKey, setDiscoveryKey] = useState({});
    const picker = useLocalSubtitlePicker({ source, host, subtitleFiles: files, initialFiles: files, discoveryKey });
    return (
        <>
            <output data-open={picker.subtitleTrackSelectorOpen} data-error={picker.embedded.error}>
                {picker.subtitleTrackSelectorSelectedTrackIds.join(',')}
            </output>
            <output data-audio>{picker.audioTracks?.map((track) => track.codec).join(',')}</output>
            <ul>
                {picker.subtitleTrackSelectorTracks.map((track) => (
                    <li key={track.id} data-disabled={track.disabledReason}>
                        {track.label}
                    </li>
                ))}
            </ul>
            <button
                data-action="import"
                onClick={() => {
                    // Match the app's successful manual import: reset, load files, then apply picker policy.
                    picker.closeSubtitleTrackSelector();
                    setDiscoveryKey({});
                    if (incoming.video) setSource(incoming.video);
                    if (incoming.files.length) setFiles(incoming.files);
                    picker.onFilesImported(incoming.video, incoming.files);
                }}
            >
                Import
            </button>
            <button data-action="open" onClick={picker.openSubtitleTrackSelector}>
                Open
            </button>
            <button data-action="close" onClick={picker.closeSubtitleTrackSelector}>
                Close
            </button>
            <button
                data-action="replace"
                onClick={() => {
                    picker.closeSubtitleTrackSelector();
                    setSource(incoming.video);
                    setDiscoveryKey({});
                    picker.openSubtitleTrackSelectorWithFiles(incoming.files);
                }}
            >
                Replace video
            </button>
        </>
    );
}

let container: HTMLDivElement;
let root: Root;

const output = () => container.querySelector('output')!;

const click = async (action: string) => {
    ioGeneration++;
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click());
};

const render = async (incoming: Import, restored?: Import) =>
    act(async () => root.render(<Harness incoming={incoming} restored={restored} />));

const finishRead = async (index: number) => act(async () => reads[index].finish());

beforeAll(() => {
    if (!AbortSignal.prototype.throwIfAborted) {
        AbortSignal.prototype.throwIfAborted = function () {
            if (this.aborted) throw this.reason;
        };
    }
});

beforeEach(() => {
    reads = [];
    jest.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    expect(host.extractSubtitles).not.toHaveBeenCalled();
});

it.each([0, 1, 2])('automatically opens only for multiple external subtitles (%i files)', async (count) => {
    const files = Array.from({ length: count }, (_, index) => subtitle(String(index)));
    await render({ files });
    await click('import');
    expect(output().dataset.open).toBe(String(count > 1));
    if (count > 1) expect(output().textContent).toBe('0,1,-');
    expect(reads).toHaveLength(0);
});

it('opens a video-only import after supported embedded tracks are discovered', async () => {
    await render({ video: video('episode'), files: [] });
    await click('import');
    expect(output().dataset.open).toBe('false');
    await finishRead(0);
    expect(output().dataset.open).toBe('true');
});

it.each(['S_HDMV/PGS', 'S_VOBSUB', 'S_DVBSUB'])(
    'automatically opens and enables embedded bitmap tracks (%s)',
    async (codec) => {
        await render({ video: video('episode', codec), files: [] });
        await click('import');
        await finishRead(0);
        expect(output().dataset.open).toBe('true');
        const lastChoice = container.querySelector('li:last-child')!;
        expect(lastChoice.getAttribute('data-disabled')).toBeNull();
    }
);

it.each(['S_TEXT/UNKNOWN', ''])(
    'does not automatically open for unsupported or absent embedded subtitles (%s)',
    async (codec) => {
        await render({ video: video('episode', codec), files: [] });
        await click('import');
        await finishRead(0);
        expect(output().dataset.open).toBe('false');
        if (codec) {
            await click('open');
            expect(container.querySelector('li:last-child')?.getAttribute('data-disabled')).toBe(
                'Unsupported S_TEXT/UNKNOWN'
            );
        }
    }
);

it('retains external subtitles while checking audio, and discovers subtitles on explicit open', async () => {
    await render({ video: video('episode'), files: [] }, { files: [subtitle('en')] });
    await click('import');
    expect(output().dataset.open).toBe('false');
    expect(reads).toHaveLength(1);
    await finishRead(0);
    await click('open');
    await finishRead(1);
    expect(output().dataset.open).toBe('true');
    expect(output().textContent).toBe('en,-,-');
    expect([...container.querySelectorAll('li')].map((choice) => choice.textContent)).toEqual([
        'extension.videoDataSync.emptySubtitleTrack',
        'en.srt',
        'English · SRT · Track 1',
    ]);
});

it('does not automatically open or discover when restoring a session', async () => {
    await render({ files: [] }, { video: video('restored'), files: [subtitle('ja'), subtitle('en')] });
    expect(output().dataset.open).toBe('false');
    expect(reads).toHaveLength(0);
});

it('does not reopen after cancellation, and can rediscover on explicit open', async () => {
    await render({ video: video('episode'), files: [] });
    await click('import');
    await click('close');
    await finishRead(0);
    expect(output().dataset.open).toBe('false');
    await click('open');
    await finishRead(1);
    expect(output().dataset.open).toBe('true');
});

it.each([false, true])('ignores cancelled discovery for a replacement import (same file: %s)', async (sameFile) => {
    const original = video('old');
    await render({ video: original, files: [] });
    await click('import');
    await render({ video: sameFile ? original : video('replacement'), files: [] });
    await click('import');
    await finishRead(0);
    expect(output().dataset.open).toBe('false');
    await finishRead(1);
    expect(output().dataset.open).toBe('true');
});

it.each([0, 1, 2])(
    'defers selection of %i incoming subtitle files while the replacement video loads',
    async (count) => {
        const files = Array.from({ length: count }, (_, index) => subtitle(`new-${index}`));
        await render({ video: video('replacement'), files }, { video: video('old'), files: [subtitle('old')] });
        await click('open');
        await click('replace');
        expect(output().dataset.open).toBe('true');
        expect(output().textContent).toBe([0, 1, 2].map((index) => files[index]?.id ?? '-').join(','));
        await finishRead(0);
        expect(container.textContent).not.toContain('English · SRT · Track 1');
        await finishRead(1);
        expect([...container.querySelectorAll('li')].map((choice) => choice.textContent)).toEqual([
            'extension.videoDataSync.emptySubtitleTrack',
            ...files.map(({ file }) => file.name),
            'English · SRT · Track 1',
        ]);
    }
);

it('reapplies cached embedded choices when reimporting the active video with different subtitle files', async () => {
    const active = video('active');
    await render({ video: active, files: [subtitle('new')] }, { video: active, files: [subtitle('old')] });
    await click('open');
    await finishRead(0);
    await click('replace');
    expect(output().textContent).toBe('new,-,-');
    expect([...container.querySelectorAll('li')].map((choice) => choice.textContent)).toEqual([
        'extension.videoDataSync.emptySubtitleTrack',
        'new.srt',
        'English · SRT · Track 1',
    ]);
    expect(reads).toHaveLength(1);
});

it('does not reopen if an external subtitle arrives during discovery', async () => {
    await render({ video: video('episode'), files: [] });
    await click('import');
    await render({ files: [subtitle('en')] });
    await click('import');
    await finishRead(0);
    expect(output().dataset.open).toBe('false');
});

it('leaves the picker closed when automatic discovery fails', async () => {
    await render({ video: video('episode'), files: [] });
    await click('import');
    await act(async () => reads[0].reject(new Error('File read failed')));
    expect(output().dataset.open).toBe('false');
    expect(output().dataset.error).toBe('true');
});

it.each([0, 1, 2])('opens for %i audio tracks only when there are multiple choices', async (count) => {
    await render({ video: video('episode', '', Array(count).fill('A_AAC')), files: [] });
    await click('import');
    await finishRead(0);
    expect(output().dataset.open).toBe(String(count > 1));
    expect(container.querySelector('[data-audio]')!.textContent).toBe(Array(count).fill('aac').join(','));
});

it.each([false, true])('opens for multiple audio tracks with external subtitles (imported: %s)', async (imported) => {
    const external = [subtitle('ja')];
    await render(
        { video: video('episode', '', ['A_AAC', 'A_OPUS']), files: imported ? external : [] },
        imported ? undefined : { files: external }
    );
    await click('import');
    await finishRead(0);
    expect(output().dataset.open).toBe('true');
    expect(output().textContent).toBe('ja,-,-');
});
