import { afterEach, beforeAll, beforeEach, expect, it, jest } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { TextDecoder } from 'util';
import type { ConfirmedVideoDataSubtitleTrack, LoadableSubtitleTrack } from '@project/common';
import type { FileWithId } from '@project/common/file-selector';
import { EmbeddedSubtitles } from '@project/common/embedded-subtitles/embedded-subtitles';
import { embeddedDescriptor, embeddedSubtitleId } from '@project/common/embedded-subtitles/subtitle-source';
import type { SubtitleHost } from '@project/common/embedded-subtitles/subtitle-source';
import { mkv, mkvTrack } from '@project/common/media-probe/test-media';
import { MediaSources } from '@project/common/app/services/media-sources';
import { useSubtitleSelection } from '@project/common/app/hooks/use-subtitle-selection';

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
const originalFetch = globalThis.fetch;

function Harness({
    tracks,
    selectedIds = tracks.map(({ id }) => id),
}: {
    tracks: ConfirmedVideoDataSubtitleTrack[];
    selectedIds?: string[];
}) {
    const selection = useSubtitleSelection({ source, service, selectedTrackIds: selectedIds, sources });
    return (
        <>
            <output data-busy={selection.busy} data-error={selection.error} />
            <button data-action="confirm" onClick={() => selection.confirm(tracks, commit)}>
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

const render = async (tracks = [choice(source)], selectedIds?: string[]) =>
    act(async () => root.render(<Harness tracks={tracks} selectedIds={selectedIds} />));

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
