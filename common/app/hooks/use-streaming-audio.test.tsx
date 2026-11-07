import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { useStreamingAudio } from '@project/common/app/hooks/use-streaming-audio';
import type { TranscodedAudioPayload } from '@project/common';
import type { AudioSeekableRange } from '@project/common/audio-transcode/streaming-audio';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// MediaSource and object URLs are browser boundaries; the hook and Blob lifetimes remain real.
class Source extends EventTarget {
    static isTypeSupported = () => true;
    readyState = 'closed';
}
let root: Root;
let container: HTMLDivElement;
let created: (Blob | MediaSource)[];
let released: string[];
let buffered: (AudioSeekableRange | undefined)[];
const originalMediaSource = Object.getOwnPropertyDescriptor(globalThis, 'MediaSource');
const prefix = new Blob(['prefix']);
const completed = new Blob(['prefix and the remaining audio']);
const Harness = ({ conversion }: { conversion: TranscodedAudioPayload }) => {
    const url = useStreamingAudio({
        conversion,
        video: undefined,
        onBuffered: (range) => buffered.push(range),
        onError: (error) => {
            throw error;
        },
    });
    return <output>{url}</output>;
};
const render = async (conversion: TranscodedAudioPayload = { state: 'transcoding', required: true, audio: prefix }) => {
    await act(async () => root.render(<Harness conversion={conversion} />));
};
const url = () => container.querySelector('output')!.textContent;
beforeEach(() => {
    root = createRoot((container = document.createElement('div')));
    created = [];
    released = [];
    buffered = [];
    Object.defineProperty(globalThis, 'MediaSource', { value: Source, configurable: true });
    URL.createObjectURL = jest.fn((value: Blob | MediaSource) => {
        created.push(value);
        return `blob:audio-${created.length}`;
    });
    URL.revokeObjectURL = jest.fn((url: string) => released.push(url));
});
afterEach(async () => {
    await act(async () => root.unmount());
    if (originalMediaSource) Object.defineProperty(globalThis, 'MediaSource', originalMediaSource);
    else delete (globalThis as { MediaSource?: unknown }).MediaSource;
    jest.restoreAllMocks();
});

it.each(['absent', 'unsupported'])('waits for a completed Blob when MSE is %s', async (support) => {
    if (support === 'absent') delete (globalThis as { MediaSource?: unknown }).MediaSource;
    else jest.spyOn(Source, 'isTypeSupported').mockReturnValue(false);
    await render();
    await render({ state: 'transcoding', required: true, audio: new Blob([prefix, 'more']) });
    expect(url()).toBe('');
    expect(created).toEqual([]);
    expect(buffered).toEqual([{ start: 0, end: 0 }]);

    await render({ audio: completed, state: 'ready', required: true });
    expect(url()).toBe('blob:audio-1');
    expect(created).toEqual([completed]);
    expect(buffered.at(-1)).toBeUndefined();
    await render({ state: 'idle', required: true });
    expect(url()).toBe('');
    expect(released).toEqual(['blob:audio-1']);
});

it.each(['idle', 'failed'] as const)(
    'keeps one MSE source as the prefix grows, then releases completed Blob playback when %s',
    async (state) => {
        await render();
        expect(url()).toBe('blob:audio-1');
        expect(created[0]).toBeInstanceOf(Source);
        await render({ state: 'transcoding', required: true, audio: new Blob([prefix, 'more']) });
        expect(url()).toBe('blob:audio-1');
        expect(created).toHaveLength(1);
        await render({ audio: completed, state: 'ready', required: true });
        expect(url()).toBe('blob:audio-2');
        expect(created[1]).toBe(completed);
        expect(released).toEqual(['blob:audio-1']);
        await render({ state, required: true });
        expect(released).toEqual(['blob:audio-1', 'blob:audio-2']);
        expect(url()).toBe('');
    }
);
