import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { TranscodedAudioModel } from '@project/common';
import { useClampTimestampInterval } from '@project/common/hooks/use-clamp-timestamp-interval';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
const interval = [-10, 1_000, 8_000];
const Harness = (props: Parameters<typeof useClampTimestampInterval>[0]) => {
    const clamp = useClampTimestampInterval(props);
    return <output>{JSON.stringify(clamp(interval))}</output>;
};
const deferredClip = () => {
    let finish!: (duration: number) => void;
    const duration = new Promise<number>((resolve) => {
        finish = resolve;
    });
    return { clip: { sourceDurationMs: () => duration }, finish };
};
const render = async (source: TranscodedAudioModel | undefined, clip: ReturnType<typeof deferredClip>, open = true) => {
    await act(async () => root.render(<Harness open={open} audioClip={clip.clip} source={source} />));
};
const result = () => JSON.parse(container.textContent!);

beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
});

it('leaves ordinary media unrestricted and clamps snapshots to zero until their duration is known', async () => {
    const clip = deferredClip();
    await render(undefined, clip);
    expect(result()).toEqual(interval);
    await render({ complete: true, blobUrl: 'blob:first' }, clip);
    expect(result()).toEqual([0, 0, 0]);
    await act(async () => clip.finish(5_000.9));
    expect(result()).toEqual([0, 1_000, 5_000]);
});

it('ignores duration results for a replaced source or a closed dialog', async () => {
    const first = deferredClip();
    const second = deferredClip();
    const source = { complete: true, blobUrl: 'blob:second' };
    await render({ complete: true, blobUrl: 'blob:first' }, first);
    await render(source, second);
    await act(async () => first.finish(9_000));
    expect(result()).toEqual([0, 0, 0]);
    await render(source, second, false);
    await act(async () => second.finish(6_000));
    expect(result()).toEqual([0, 0, 0]);
    await render(source, second);
    expect(result()).toEqual([0, 1_000, 6_000]);
});
