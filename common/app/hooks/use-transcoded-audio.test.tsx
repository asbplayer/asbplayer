import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { FileWithId } from '@project/common/file-selector';
import { TestHost, webmHeader } from '@project/common/audio-transcode/test-host';
import { useTranscodedAudio } from '@project/common/app/hooks/use-transcoded-audio';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Harness = ({ file, host }: { file?: FileWithId; host: TestHost }) => {
    const conversion = useTranscodedAudio(file, host);
    return (
        <>
            <output
                data-state={conversion.state}
                data-bytes={conversion.blob?.size}
                data-complete={conversion.complete}
                data-required={conversion.required}
                data-error={conversion.error === undefined ? undefined : String(conversion.error)}
            >
                {conversion.codecName}
            </output>
            <button onClick={conversion.clearFailure}>Close</button>
            <button onClick={() => conversion.fail(new Error('Playback failed'))}>Fail</button>
        </>
    );
};

let container: HTMLDivElement;
let root: Root;
let nextUrl = 0;
// Only the track header is needed to exercise the real codec probe.
const box = (type: string, ...parts: Uint8Array[]) => {
    const bytes = new Uint8Array(8 + parts.reduce((size, part) => size + part.length, 0));
    new DataView(bytes.buffer).setUint32(0, bytes.length);
    bytes.set(
        [...type].map((character) => character.charCodeAt(0)),
        4
    );
    let offset = 8;
    for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
    }
    return bytes;
};
const audioHeader = box(
    'moov',
    box(
        'trak',
        box(
            'mdia',
            box('hdlr', new Uint8Array(8), new Uint8Array([115, 111, 117, 110])), // soun
            box('minf', box('stbl', box('stsd', new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]), box('ac-3'))))
        )
    )
);
const file = (id: string): FileWithId => ({
    id,
    file: new File([audioHeader], `${id}.mp4`),
});
const state = () => container.querySelector('output')!.getAttribute('data-state');
const render = async (file: FileWithId | undefined, host: TestHost) => {
    await act(async () => root.render(<Harness file={file} host={host} />));
};
const click = async (index: number) => {
    await act(async () => container.querySelectorAll('button')[index].click());
};
const waitForState = async (expected: string) => {
    const deadline = Date.now() + 2000;
    while (state() !== expected && Date.now() < deadline) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
        });
    }
    expect(state()).toBe(expected);
};

const waitForRequirement = async () => {
    const deadline = Date.now() + 2000;
    while (container.querySelector('output')!.getAttribute('data-required') !== 'true' && Date.now() < deadline) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
        });
    }
    expect(container.querySelector('output')!.getAttribute('data-required')).toBe('true');
};

const waitForWorker = async (host: TestHost, index = 0) => {
    const deadline = Date.now() + 2000;
    while (host.workers.length <= index && Date.now() < deadline) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
        });
    }
    expect(host.workers.length).toBeGreaterThan(index);
    await host.workers[index].started;
};

const waitForComplete = async () => {
    const deadline = Date.now() + 2000;
    while (container.querySelector('output')?.getAttribute('data-complete') !== 'true' && Date.now() < deadline) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
        });
    }
    expect(container.querySelector('output')!.getAttribute('data-complete')).toBe('true');
};

beforeAll(() => {
    // jsdom predates this standard AbortSignal method.
    if (AbortSignal.prototype.throwIfAborted === undefined) {
        AbortSignal.prototype.throwIfAborted = function () {
            if (this.aborted) throw this.reason;
        };
    }
    if (Blob.prototype.arrayBuffer === undefined) {
        Blob.prototype.arrayBuffer = function () {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(this);
            });
        };
    }
});
beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    // Browser codec support and Blob URLs are the external boundaries.
    jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockImplementation((mime) =>
        mime === 'video/mp4' ? 'probably' : ''
    );
    URL.createObjectURL = jest.fn(() => `blob:converted-${++nextUrl}`);
    URL.revokeObjectURL = jest.fn();
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.restoreAllMocks();
});

it('starts converting an undecodable track automatically and reports its codec', async () => {
    const host = new TestHost();
    host.autoComplete = false;
    await render(file('a'), host);
    await waitForState('transcoding');
    expect(container.querySelector('output')!.textContent).toBe('AC-3');
    expect(container.querySelector('output')!.getAttribute('data-required')).toBe('true');
    await waitForWorker(host);
    expect(host.workers).toHaveLength(1);
    await act(async () => host.workers[0].complete());
    await waitForComplete();
});

it('retains complete audio for mining and clears it when the file changes', async () => {
    const host = new TestHost();
    await render(file('a'), host);
    await waitForState('ready');
    expect(container.querySelector('output')!.getAttribute('data-bytes')).toBe(String(webmHeader.length + 3));
    await waitForComplete();
    expect(host.workers[0].active).toBe(false);
    await render(undefined, host);
    expect(state()).toBe('idle');
    expect(container.querySelector('output')!.getAttribute('data-required')).toBe('false');
    expect(container.querySelector('output')!.textContent).toBe('');
    expect(container.querySelector('output')!.getAttribute('data-bytes')).toBeNull();
});

it('makes the prefix available while conversion remains incomplete', async () => {
    const host = new TestHost();
    host.autoComplete = false;
    await render(file('a'), host);
    await waitForWorker(host);
    await act(async () => host.workers[0].chunk(new Uint8Array([4, 5]).buffer));
    expect(state()).toBe('transcoding');
    expect(container.querySelector('output')!.getAttribute('data-complete')).toBe('false');
    expect(container.querySelector('output')!.getAttribute('data-bytes')).toBe(String(webmHeader.length + 2));
    expect(host.workers[0].active).toBe(true);
    await act(async () => host.workers[0].complete());
    await waitForComplete();
});

it.each(['file change', 'unmount'])('terminates a native conversion on %s', async (action) => {
    const host = new TestHost();
    host.autoComplete = false;
    await render(file('a'), host);
    await waitForWorker(host);
    if (action === 'file change') await render(file('b'), host);
    else {
        await act(async () => root.unmount());
        root = createRoot(container);
    }
    expect(host.workers[0].active).toBe(false);
    await act(async () => host.workers[0].complete());
    expect(container.querySelector('output')?.getAttribute('data-bytes')).toBeFalsy();
    if (action === 'file change') {
        // The new file's conversion starts on its own with a fresh session.
        await waitForWorker(host, 1);
        expect(state()).toBe('transcoding');
    }
});

it('retains the conversion requirement without starting a worker when WebM Opus is unsupported', async () => {
    const host = new TestHost();
    host.supportsAudioPlayback = () => false;
    await render(file('a'), host);
    await waitForRequirement();
    expect(state()).toBe('idle');
    expect(container.querySelector('output')!.textContent).toBe('AC-3');
    expect(host.workers).toHaveLength(0);
});

it('reports a runtime download failure instead of silently disabling conversion', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const host = new TestHost();
    host.prepareError = new TypeError('Failed to fetch');
    await render(file('a'), host);
    await waitForState('failed');
    expect(container.querySelector('output')!.getAttribute('data-required')).toBe('true');
    expect(container.querySelector('output')!.getAttribute('data-error')).toContain('Failed to fetch');
    expect(host.workers).toHaveLength(0);
});

it('terminates conversion when streamed playback fails and retains the failure', async () => {
    const host = new TestHost();
    host.autoComplete = false;
    await render(file('a'), host);
    await waitForWorker(host);
    await click(1);
    expect(state()).toBe('failed');
    expect(host.workers[0].active).toBe(false);
    expect(container.querySelector('output')!.getAttribute('data-bytes')).toBeNull();
    expect(container.querySelector('output')!.getAttribute('data-error')).toContain('Playback failed');
});

it('closes a failure notice without restarting conversion', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const host = new TestHost();
    host.error = 'Invalid media';
    await render(file('a'), host);
    await waitForState('failed');
    expect(container.querySelector('output')!.getAttribute('data-error')).toContain('Invalid media');
    await click(0);
    expect(state()).toBe('idle');
    expect(container.querySelector('output')!.getAttribute('data-required')).toBe('true');
    expect(host.workers).toHaveLength(1);
});
