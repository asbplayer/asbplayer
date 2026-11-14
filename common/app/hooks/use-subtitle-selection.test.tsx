import { afterEach, beforeAll, beforeEach, expect, it, jest } from '@jest/globals';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { TextDecoder, TextEncoder } from 'util';
import { SubtitleHtml } from '@project/common';
import type { ConfirmedVideoDataSubtitleTrack, DisplaySubtitleModel, LoadableSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import { EmbeddedSubtitles } from '@project/common/embedded-subtitles/embedded-subtitles';
import { embeddedDescriptor, embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import type {
    ExtractedSubtitleFile,
    SubtitleExtractionOptions,
    SubtitleHost,
} from '@project/common/embedded-subtitles/subtitle-source';
import { embeddedSubtitleProducer } from '@project/common/embedded-subtitles/embedded-subtitle-producer';
import { mkv, mkvTrack } from '@project/common/media-probe/test-media';
import { MediaSources } from '@project/common/app/services/media-sources';
import { useSubtitleSelection } from '@project/common/app/hooks/use-subtitle-selection';
import { useSubtitleTracks } from '@project/common/app/hooks/use-subtitle-tracks';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { subtitleKey, subtitleSourceStatus as sourceStatus } from '@project/common/subtitle-reader/subtitle-stream';
import type { SubtitleSourceProducer } from '@project/common/subtitle-reader/subtitle-stream';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.assign(globalThis, { TextDecoder });

const video = (id: string): FileWithId => {
    const bytes = mkv(mkvTrack(1, 'V_VP8'), mkvTrack(17, 'S_TEXT/UTF8'));
    const file = new File([], `${id}.mkv`);
    Object.defineProperty(file, 'size', { value: bytes.length });
    file.slice = () => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer }) as Blob;
    return { id, file };
};

const choice = (source: FileWithId): ConfirmedVideoDataSubtitleTrack => ({
    id: embeddedSubtitleId(source.id, 0),
    embedded: embeddedDescriptor(source, { trackIndex: 0, codec: 'subrip', outputFormat: 'srt' }),
    extension: 'srt',
    label: 'English',
    name: 'English',
});

const extract = jest.fn<SubtitleHost['extractSubtitles']>(async () => {
    throw new Error('Selection preparation must not start extraction');
});
const host: SubtitleHost = { extractSubtitles: extract };
let source: FileWithId;
let service: EmbeddedSubtitles;
let commit: ReturnType<
    typeof jest.fn<(tracks: LoadableSubtitleTrack<FileWithId>[], signal: AbortSignal) => Promise<void>>
>;
let sources: MediaSources;
let subtitleSourceStatus: 'loading' | 'complete' | 'failed';
const onSubtitlesUnchanged = jest.fn<() => void>();
const originalFetch = globalThis.fetch;

function Harness({
    tracks,
    selectedIds = tracks.map(({ id }) => id),
    audioTrackIndex = sources.audioTrackIndex,
}: {
    tracks: ConfirmedVideoDataSubtitleTrack[];
    selectedIds?: string[];
    audioTrackIndex?: number;
}) {
    const selection = useSubtitleSelection({ source, service, selectedTrackIds: selectedIds, sources });
    return (
        <>
            <output data-busy={selection.busy} data-error={selection.error} />
            <button
                data-action="confirm"
                onClick={() =>
                    selection.confirm({
                        tracks,
                        audioTrackIndex,
                        subtitleSourceStatus,
                        onSubtitlesUnchanged,
                        commit,
                    })
                }
            >
                Confirm
            </button>
            <button data-action="cancel" onClick={selection.cancel}>
                Cancel
            </button>
        </>
    );
}

let container: HTMLDivElement;
let root: Root;

const output = () => container.querySelector('output')!;

const click = async (action: string) =>
    act(async () => container.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click());

const render = async (tracks = [choice(source)], selectedIds?: string[], audioTrackIndex?: number) =>
    act(async () =>
        root.render(<Harness tracks={tracks} selectedIds={selectedIds} audioTrackIndex={audioTrackIndex} />)
    );

beforeAll(() => {
    if (!AbortSignal.prototype.throwIfAborted) {
        AbortSignal.prototype.throwIfAborted = function () {
            if (this.aborted) throw this.reason;
        };
    }
});

beforeEach(() => {
    source = video('video');
    extract.mockClear();
    sources = new MediaSources();
    subtitleSourceStatus = 'complete';
    onSubtitlesUnchanged.mockClear();
    service = new EmbeddedSubtitles(host);
    commit = jest.fn(async () => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.fetch = originalFetch;
});

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

    await render([choice(source), online, local]);
    await click('confirm');
    expect(commit.mock.calls[0][0].map(({ fileParts }) => fileParts[0].id)).toEqual([
        choice(source).id,
        'online',
        'local',
    ]);
    expect(commit.mock.calls[0][0][0].fileParts[0].file.size).toBe(0);
    expect(commit.mock.calls[0][0][2].fileParts[0].file).toBe(local.file);
    expect(download.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);

    download.mockClear();
    await render([empty, online, online]);
    await click('confirm');
    const tracks = commit.mock.calls[1][0];
    expect(tracks.map(({ fileParts }) => fileParts[0].id)).toEqual(['-', 'online', 'online']);
    expect(tracks[1].fileParts[0]).toBe(tracks[2].fileParts[0]);
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
    await render([empty, online]);
    await click('confirm');
    expect(output().dataset.error).toBe('true');
    expect(output().dataset.busy).toBe('false');
    expect(commit).not.toHaveBeenCalled();

    await click('confirm');
    expect(output().dataset.error).toBe('false');
    expect(commit.mock.calls[0][0].map(({ fileParts }) => fileParts[0].id)).toEqual(['-', 'online']);
    expect(extract).not.toHaveBeenCalled();
});

it('ignores a download that finishes after the selection was cancelled', async () => {
    let finish!: (response: Response) => void;
    const download = jest.fn<typeof fetch>(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    globalThis.fetch = download;
    await render([
        { id: 'online', url: 'https://example.test/subtitles', extension: 'srt', label: 'Online', name: 'Online' },
    ]);
    await click('confirm');
    expect(output().dataset.busy).toBe('true');
    await click('cancel');
    expect(download.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () => finish({ ok: true, blob: async () => new Blob(['late']) } as Response));
    expect(output().dataset.busy).toBe('false');
    expect(output().dataset.error).toBe('false');
    expect(commit).not.toHaveBeenCalled();
});

it('commits resolved slots together and preserves every part of existing subtitle tracks', async () => {
    const first = { id: 'first', file: new File(['first'], 'first.srt') };
    const second = { id: 'second', file: new File(['second'], 'second.srt') };
    sources = MediaSources.fromFiles([
        { ...first, track: 0 },
        { ...second, track: 0 },
    ]);
    const local = { ...first, name: 'first', label: 'first', extension: 'srt' };
    const empty = { id: '-', name: '-', label: '-', extension: 'srt' };
    await render([local, empty, local]);
    await click('confirm');
    const tracks = commit.mock.calls[0][0];
    expect(tracks[0]).toBe(sources.subtitleTracks[0]);
    expect(tracks[2]).toBe(sources.subtitleTracks[0]);
    expect(tracks[1].fileParts[0].id).toBe('-');
    expect(extract).not.toHaveBeenCalled();
});

it('hands the prepared selection to the caller without starting extraction and ignores duplicate confirmation', async () => {
    let release!: () => void;
    commit.mockImplementation(
        () =>
            new Promise<void>((resolve) => {
                release = resolve;
            })
    );
    await render();
    await click('confirm');
    await click('confirm');
    expect(extract).not.toHaveBeenCalled();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0][0].fileParts[0]).toMatchObject({
        id: choice(source).id,
        embedded: choice(source).embedded,
    });
    expect(output().dataset.busy).toBe('true');
    await act(async () => release());
    expect(output().dataset.busy).toBe('false');
});

it.each(['cancel', 'replace', 'unmount'])('aborts a pending confirmation after %s', async (action) => {
    let release!: () => void;
    commit.mockImplementation(
        () =>
            new Promise<void>((resolve) => {
                release = resolve;
            })
    );
    await render();
    await click('confirm');
    const signal = commit.mock.calls[0][1];
    if (action === 'cancel') {
        await click('cancel');
    } else if (action === 'replace') {
        source = video('replacement');
        await render();
    } else {
        await act(async () => root.render(null));
    }
    expect(signal.aborted).toBe(true);
    await act(async () => release());
    expect(extract).not.toHaveBeenCalled();
    if (action !== 'unmount') expect(output().dataset.error).toBe('false');
});

it('rejects stale choices and allows retry after a failed commit without extracting subtitles', async () => {
    await render(undefined, ['different']);
    await click('confirm');
    expect(output().dataset.error).toBe('true');
    expect(commit).not.toHaveBeenCalled();
    await render();
    commit.mockRejectedValueOnce(new Error('Session save failed'));
    await click('confirm');
    expect(output().dataset.error).toBe('true');
    expect(output().dataset.busy).toBe('false');
    await click('confirm');
    expect(output().dataset.error).toBe('false');
    expect(commit).toHaveBeenCalledTimes(2);
    expect(extract).not.toHaveBeenCalled();
});

it.each([{ tracks: [] }, { tracks: [{ id: '-', name: '-', label: '-', extension: 'srt' }] }])(
    'confirms an unchanged empty selection without preparing subtitles: $tracks',
    async ({ tracks }) => {
        await render(tracks);
        await click('confirm');
        expect(onSubtitlesUnchanged).toHaveBeenCalledTimes(1);
        expect(commit).not.toHaveBeenCalled();
        expect(extract).not.toHaveBeenCalled();
        expect(output().dataset.busy).toBe('false');
    }
);

it('retries an unchanged failed subtitle load, while allowing an audio-only change to preserve it', async () => {
    const file = { id: 'local', file: new File(['local'], 'local.srt') };
    sources = MediaSources.fromFiles([file]);
    const tracks = [{ ...file, name: 'local', label: 'local', extension: 'srt' }];
    subtitleSourceStatus = 'failed';
    await render(tracks, undefined, 1);
    await click('confirm');
    expect(onSubtitlesUnchanged).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();

    await render(tracks);
    await click('confirm');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(onSubtitlesUnchanged).toHaveBeenCalledTimes(1);
});

it('retries a failed session commit even when the selection has already been applied', async () => {
    const local = { id: 'local', file: new File(['local'], 'local.srt') };
    const tracks = [{ ...local, name: 'local', label: 'local', extension: 'srt' }];
    commit.mockImplementationOnce(async () => {
        sources = MediaSources.fromFiles([local]);
        throw new Error('Session save failed');
    });
    await render(tracks);
    await click('confirm');
    expect(output().dataset.error).toBe('true');
    await render(tracks);
    await click('confirm');
    expect(commit).toHaveBeenCalledTimes(2);
    expect(onSubtitlesUnchanged).not.toHaveBeenCalled();
    expect(output().dataset.error).toBe('false');
});

// Exercise the same selection and streaming hooks as App/Player with a real embedded producer.
function StreamingPicker({ producer }: { producer: SubtitleSourceProducer }) {
    const [playing, setPlaying] = useState(sources);
    const [subtitles, setSubtitles] = useState<DisplaySubtitleModel[]>();
    const [open, setOpen] = useState(true);
    const [selectedId, setSelectedId] = useState(choice(source).id);
    const [audioTrackIndex, setAudioTrackIndex] = useState(playing.audioTrackIndex);
    const { sourceStates } = useSubtitleTracks({
        source: { kind: 'producer', producer, supportsProgressiveSubtitles: true, onStarted: () => {} },
        subtitles,
        channel: undefined,
        getSubtitleOffset: () => 500,
        onSubtitles: setSubtitles,
        onError: (error) => {
            throw error;
        },
    });
    const selection = useSubtitleSelection({ source, service, selectedTrackIds: [selectedId], sources: playing });
    return (
        <>
            <output data-open={open} data-audio={playing.audioTrackIndex} data-status={sourceStatus(sourceStates)}>
                {subtitles?.map((cue) => (
                    <span key={subtitleKey(cue)} data-source={subtitleKey(cue)} data-start={cue.start}>
                        {cue.text}
                    </span>
                ))}
            </output>
            <select data-action="subtitle" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                <option value={choice(source).id}>English</option>
                <option value="-">Empty</option>
            </select>
            <select
                data-action="audio"
                value={audioTrackIndex ?? ''}
                onChange={(event) =>
                    setAudioTrackIndex(event.target.value === '' ? undefined : Number(event.target.value))
                }
            >
                <option value="">Default</option>
                <option value="1">Second audio track</option>
            </select>
            <button
                data-action="annotate"
                onClick={() =>
                    setSubtitles((previous) =>
                        previous?.map((cue) => ({
                            ...cue,
                            originalText: cue.text,
                            text: `<b>${cue.text}</b>`,
                            tokenization: { tokens: [] },
                        }))
                    )
                }
            >
                Annotate
            </button>
            <button
                data-action="confirm"
                onClick={() =>
                    selection.confirm({
                        tracks: [
                            selectedId === '-' ? { id: '-', name: '-', label: '-', extension: 'srt' } : choice(source),
                        ],
                        audioTrackIndex,
                        subtitleSourceStatus: sourceStatus(sourceStates),
                        onSubtitlesUnchanged: () => {
                            setPlaying((previous) => previous.withAudioTrackIndex(audioTrackIndex));
                            selection.cancel();
                            setOpen(false);
                        },
                        commit,
                    })
                }
            >
                Confirm
            </button>
        </>
    );
}

it.each(['audio change', 'switch back'])(
    'preserves active extraction, cue identities, annotations and offsets after confirming %s',
    async (action) => {
        let extraction!: SubtitleExtractionOptions;
        let finish!: (files: ExtractedSubtitleFile[]) => void;
        extract.mockImplementationOnce(
            (options) =>
                new Promise((resolve, reject) => {
                    extraction = options;
                    finish = resolve;
                    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
                })
        );
        const selected = choice(source);
        const prepared = await service.prepare(source, [selected.embedded!], new AbortController().signal);
        sources = MediaSources.fromFiles([source, ...prepared.values()]);
        const reader = new SubtitleReader({
            regexFilter: '',
            regexFilterTextReplacement: '',
            subtitleHtml: SubtitleHtml.render,
            convertNetflixRuby: false,
            pgsParserWorkerFactory: async () => {
                throw new Error('Text source');
            },
        });
        const onComplete = jest.fn<Parameters<typeof embeddedSubtitleProducer>[0]['onComplete']>(async () => {});
        const producer = embeddedSubtitleProducer({
            source,
            tracks: sources.subtitleTracks,
            pendingDescriptors: [selected.embedded!],
            service,
            reader,
            errorMessage: 'Extraction failed',
            onComplete,
        });
        await act(async () => root.render(<StreamingPicker producer={producer} />));
        const encoder = new TextEncoder();
        const first = encoder.encode('1\n00:00:01,000 --> 00:00:02,000\nFirst\n\n');
        const second = encoder.encode('2\n00:00:03,000 --> 00:00:04,000\nSecond\n\n');
        await act(async () => extraction.onChunk(0, first.buffer));
        await click('annotate');
        const identity = output().querySelector('span')!.dataset.source;
        const select = async (name: string, value: string) =>
            act(async () => {
                const element = container.querySelector<HTMLSelectElement>(`[data-action="${name}"]`)!;
                element.value = value;
                element.dispatchEvent(new Event('change', { bubbles: true }));
            });
        await select('audio', '1');
        if (action === 'switch back') {
            await select('audio', '');
            await select('subtitle', '-');
            await select('subtitle', selected.id);
        }
        await click('confirm');
        expect(output().dataset.open).toBe('false');
        expect(output().dataset.audio).toBe(action === 'audio change' ? '1' : undefined);
        expect(output().dataset.status).toBe('loading');
        expect(output().textContent).toBe('<b>First</b>');
        expect(output().querySelector('span')!.dataset.source).toBe(identity);
        expect(extraction.signal.aborted).toBe(false);
        expect(extract).toHaveBeenCalledTimes(1);
        expect(commit).not.toHaveBeenCalled();

        await act(async () => {
            extraction.onChunk(0, second.buffer);
            finish([{ trackIndex: 0, format: 'srt', blob: new Blob([first, second]) }]);
        });
        expect(output().dataset.status).toBe('complete');
        expect(output().textContent).toBe('<b>First</b>Second');
        expect([...output().querySelectorAll('span')].map((cue) => cue.dataset.start)).toEqual(['1500', '3500']);
        expect(output().querySelector('span')!.dataset.source).toBe(identity);
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(extract).toHaveBeenCalledTimes(1);
    }
);
