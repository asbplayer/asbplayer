import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { TranscodedAudioPayload } from '@project/common';
import { Blob as ReadableBlob } from 'node:buffer';
import { useResumePlaybackSnackbar } from '@project/common/app/hooks/use-resume-playback-snackbar';
import { webmHeader } from '@project/common/audio-transcode/test-host';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom's Blob lacks arrayBuffer; Node's Blob supplies the real immutable byte-reading boundary.
const prefix = (timestamp: number): Blob => {
    const cluster = new Uint8Array([
        0x1f, 0x43, 0xb6, 0x75, 0x8f, 0xe7, 0x84, 0, 0, 0, 0, 0xa3, 0x87, 0x81, 0, 40, 0x80, 1, 2, 3,
    ]);
    new DataView(cluster.buffer).setUint32(7, timestamp);
    return new ReadableBlob([webmHeader, cluster], { type: 'audio/webm' }) as unknown as Blob;
};

interface Props {
    conversion: TranscodedAudioPayload;
    source: string;
    onDismiss: () => void;
    subtitlesReady: boolean;
}

const Harness = ({ conversion, source, onDismiss, subtitlesReady }: Props) => {
    const [position, setPosition] = useState<number | undefined>(600_000);
    const snackbar = useResumePlaybackSnackbar({
        position,
        source,
        conversion,
        subtitlesReady,
        onDismiss: () => {
            setPosition(undefined);
            onDismiss();
        },
    });
    return (
        <button
            data-open={snackbar.open}
            data-position={position}
            onClick={snackbar.close}
            onMouseEnter={snackbar.onMouseEnter}
            onMouseLeave={snackbar.onMouseLeave}
        />
    );
};

let root: Root;
let container: HTMLDivElement;
let onDismiss: jest.Mock;
const render = async (
    conversion: TranscodedAudioPayload = { state: 'transcoding', required: true },
    source = 'video',
    subtitlesReady = true
) => {
    await act(async () =>
        root.render(
            <Harness conversion={conversion} source={source} onDismiss={onDismiss} subtitlesReady={subtitlesReady} />
        )
    );
};
const advance = async (ms: number) => {
    await act(async () => jest.advanceTimersByTimeAsync(ms));
};
const button = () => container.querySelector('button')!;
beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    onDismiss = jest.fn();
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.useRealTimers();
});

it('reoffers a timed-out position when encoded audio reaches it, beyond the playback look-ahead', async () => {
    await render();
    await advance(6_000);
    expect(button().dataset.open).toBe('false');
    expect(button().dataset.position).toBe('600000');
    expect(onDismiss).not.toHaveBeenCalled();
    await render({ state: 'transcoding', required: true, audio: prefix(120_000) });
    expect(button().dataset.open).toBe('false');
    await render({ state: 'transcoding', required: true, audio: prefix(600_000) });
    await advance(1_000);
    expect(button().dataset.open).toBe('true');
    await advance(6_000);
    expect(button().dataset.open).toBe('false');
    expect(button().dataset.position).toBeUndefined();
    expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('retains a timed-out offer until subtitles catch up and gives it a fresh timeout', async () => {
    await render({ state: 'idle', required: false }, 'video', false);
    await advance(6_000);
    expect(button().dataset.open).toBe('false');
    expect(onDismiss).not.toHaveBeenCalled();
    await render({ state: 'idle', required: false }, 'video', true);
    expect(button().dataset.open).toBe('true');
    await advance(6_000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('waits for both subtitle coverage and encoded audio before reoffering', async () => {
    await render({ state: 'transcoding', required: true }, 'video', false);
    await advance(6_000);
    await render({ state: 'transcoding', required: true }, 'video', true);
    expect(button().dataset.open).toBe('false');
    await render({ state: 'transcoding', required: true, audio: prefix(600_000) }, 'video', true);
    await advance(1_000);
    expect(button().dataset.open).toBe('true');
});

it('gives a visible offer six fresh seconds once audio reaches the position, without resetting on later chunks', async () => {
    await render();
    await advance(5_000);
    await render({ state: 'transcoding', required: true, audio: prefix(600_000) });
    await advance(5_000);
    expect(button().dataset.open).toBe('true');
    await render({ state: 'transcoding', required: true, audio: prefix(610_000) });
    await advance(999);
    expect(onDismiss).not.toHaveBeenCalled();
    await advance(1);
    expect(button().dataset.open).toBe('false');
    expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('does not reoffer a position explicitly dismissed while conversion was catching up', async () => {
    await render();
    await act(async () => button().click());
    await render({ state: 'transcoding', required: true, audio: prefix(600_000) });
    expect(button().dataset.open).toBe('false');
    expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('reoffers on completion even if the saved position lies in the silent video tail', async () => {
    await render();
    await advance(6_000);
    await render({ state: 'ready', required: true, audio: prefix(120_000) });
    expect(button().dataset.open).toBe('true');
    await advance(6_000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('keeps the original timeout for playback that does not need conversion', async () => {
    await render({ state: 'idle', required: false });
    await advance(6_000);
    expect(button().dataset.open).toBe('false');
    expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('keeps a refreshed offer open while hovered', async () => {
    await render();
    await act(async () => button().dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    await render({ state: 'transcoding', required: true, audio: prefix(600_000) });
    await advance(10_000);
    expect(button().dataset.open).toBe('true');
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => button().dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
    await advance(1_000);
    expect(button().dataset.open).toBe('false');
    expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('waits for the new file rather than reusing availability from the previous file', async () => {
    await render({ state: 'transcoding', required: true, audio: prefix(600_000) }, 'old');
    await render({ state: 'transcoding', required: true, audio: prefix(120_000) }, 'new');
    await advance(6_000);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(button().dataset.open).toBe('false');
    await render({ state: 'transcoding', required: true, audio: prefix(600_000) }, 'new');
    await advance(1_000);
    expect(button().dataset.open).toBe('true');
});

it.each(['idle', 'failed'] as const)('gives a required but %s conversion a normal resume timeout', async (state) => {
    await render({ state, required: true });
    await advance(6_000);
    expect(button().dataset.open).toBe('false');
    expect(button().dataset.position).toBeUndefined();
    expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('reoffers a timed-out position when conversion fails and playback can continue without audio', async () => {
    await render();
    await advance(6_000);
    expect(button().dataset.open).toBe('false');
    expect(onDismiss).not.toHaveBeenCalled();
    await render({ state: 'failed', required: true });
    expect(button().dataset.open).toBe('true');
    await advance(5_999);
    expect(onDismiss).not.toHaveBeenCalled();
    await advance(1);
    expect(button().dataset.position).toBeUndefined();
    expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('does not reoffer a dismissed position when conversion subsequently fails', async () => {
    await render();
    await act(async () => button().click());
    await render({ state: 'failed', required: true });
    expect(button().dataset.open).toBe('false');
    expect(onDismiss).toHaveBeenCalledTimes(1);
});
