import { afterEach, beforeAll, beforeEach, expect, it, jest } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { TextDecoder } from 'util';
import type { SubtitleHost } from '@project/common/embedded-subtitles/subtitle-source';
import { useEmbeddedSubtitles } from '@project/common/app/hooks/use-embedded-subtitles';
import { mkv, mkvTrack, element, utf8 } from '@project/common/media-probe/test-media';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.assign(globalThis, { TextDecoder });

const bytes = mkv(
    mkvTrack(1, 'V_VP8'),
    mkvTrack(2, 'A_EAC3'),
    mkvTrack(17, 'S_TEXT/UTF8', element('22b59c', utf8('jpn')))
);
let reads: { resolve: (bytes: ArrayBuffer) => void; reject: (error: Error) => void }[];
let source: { id: string; file: File };
const host: SubtitleHost = {
    extractSubtitles: jest.fn(() => {
        throw new Error('Discovery must not load FFmpeg');
    }),
};

function Harness({
    draft,
    open = true,
    discoverOnLoad = false,
}: {
    draft?: object;
    open?: boolean;
    discoverOnLoad?: boolean;
}) {
    const discovery = useEmbeddedSubtitles({ source, host, open, discoveryKey: draft, discoverOnLoad });
    return (
        <>
            <output data-loading={discovery.loading} data-error={discovery.error}>
                {discovery.tracks?.map((track) => track.trackIndex).join(',')}
            </output>
            <button onClick={discovery.cancel}>Cancel previous import</button>
        </>
    );
}

let container: HTMLDivElement;
let root: Root;

const output = () => container.querySelector('output')!;

const render = async (draft?: object, open = true, discoverOnLoad = false) => {
    await act(async () => root.render(<Harness draft={draft} open={open} discoverOnLoad={discoverOnLoad} />));
};

const finishRead = async (index: number) => act(async () => reads[index].resolve(Uint8Array.from(bytes).buffer));

beforeAll(() => {
    if (!AbortSignal.prototype.throwIfAborted) {
        AbortSignal.prototype.throwIfAborted = function () {
            if (this.aborted) throw this.reason;
        };
    }
});

beforeEach(() => {
    reads = [];
    source = { id: 'video', file: new File(['video'], 'episode.mkv') };
    // Control the file I/O boundary while using the real metadata reader and discovery service.
    Object.defineProperty(source.file, 'size', { value: bytes.length });
    source.file.slice = () =>
        ({ arrayBuffer: () => new Promise((resolve, reject) => reads.push({ resolve, reject })) }) as Blob;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    jest.clearAllMocks();
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

it('restarts cancelled discovery for a replacement draft and ignores late results', async () => {
    await render({});
    expect(output().dataset.loading).toBe('true');
    await act(async () => container.querySelector('button')!.click());
    await render({});
    await finishRead(0);
    expect(output().textContent).toBe('');
    await finishRead(1);
    expect(output().textContent).toBe('0');
    expect(output().dataset.loading).toBe('false');
    expect(host.extractSubtitles).not.toHaveBeenCalled();
});

it('reuses completed discovery when another draft selects the same video', async () => {
    await render({});
    await finishRead(0);
    await act(async () => container.querySelector('button')!.click());
    await render({});
    expect(output().textContent).toBe('0');
    expect(reads).toHaveLength(1);
});

it('reports failed discovery and retries without falling back to FFmpeg', async () => {
    await render({});
    await act(async () => reads[0].reject(new Error('Failed file read')));
    expect(output().dataset.error).toBe('true');
    await render({});
    expect(output().dataset.error).toBe('false');
    await finishRead(1);
    expect(output().textContent).toBe('0');
    expect(host.extractSubtitles).not.toHaveBeenCalled();
});

it('defers discovery while the picker is closed, then discovers video-only imports without FFmpeg', async () => {
    await render({}, false);
    expect(reads).toHaveLength(0);
    await render(undefined, false, true);
    await finishRead(0);
    expect(output().textContent).toBe('0');
    await render(undefined, true, false);
    expect(reads).toHaveLength(1);
    expect(host.extractSubtitles).not.toHaveBeenCalled();
});
