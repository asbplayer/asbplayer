import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { handleEpisodeAudioCapture } from '@/services/episode-audio-capture';

class FakeRecorder extends EventTarget {
    static last: FakeRecorder;
    state: RecordingState = 'inactive';
    constructor() {
        super();
        FakeRecorder.last = this;
    }
    start() {
        this.state = 'recording';
    }
    pause() {
        this.state = 'paused';
    }
    resume() {
        this.state = 'recording';
    }
    emit(text: string) {
        this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob([text]) }));
    }
    stop() {
        this.state = 'inactive';
        this.emit('last');
        this.dispatchEvent(new Event('stop'));
    }
}

const fetchMock = jest.fn<typeof fetch>();
const sent: (number | string)[] = [];
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const track = { addEventListener: () => {}, stop: () => {} };
const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;

// jsdom's AbortSignal predates these.
AbortSignal.prototype.throwIfAborted ??= function (this: AbortSignal) {
    if (this.aborted) throw this.reason;
};
AbortSignal.timeout ??= () => new AbortController().signal;
AbortSignal.any ??= (signals) => signals[0];

beforeEach(() => {
    sent.length = 0;
    fetchMock.mockReset();
    Object.assign(globalThis, {
        fetch: fetchMock,
        MediaRecorder: FakeRecorder,
        AudioContext: class {
            state = 'running';
            createMediaStreamSource = () => ({ connect: () => {} });
            resume = async () => {};
            close = async () => {};
        },
    });
});

afterEach(() => {
    for (const name of ['fetch', 'MediaRecorder', 'AudioContext']) Reflect.deleteProperty(globalThis, name);
});

it('streams the recording to the server in order, retrying a chunk the server missed', async () => {
    let down = true;
    fetchMock.mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname === '/append' && down) {
            down = false;
            throw new TypeError('Failed to fetch');
        }
        sent.push(url.pathname === '/append' ? (init!.body as Blob).size : url.search); // jsdom Blobs can't be read back
        return { status: url.pathname === '/append' ? 204 : 202 } as Response;
    });
    const message = (operation: any) => ({ command: 'capture-episode-audio' as const, id: 'abcd1234', tabId: 1, operation });

    await handleEpisodeAudioCapture(message({ action: 'start', key: 'E1' }), async () => stream, true);
    await handleEpisodeAudioCapture(message({ action: 'resume', offset: 38 }), async () => stream, true);
    FakeRecorder.last.emit('a'); // the server is down for this one
    await settle();
    FakeRecorder.last.emit('bb');
    await settle();
    await handleEpisodeAudioCapture(message({ action: 'finish' }), async () => stream, true);

    expect(sent).toEqual([1, 2, 4, '?key=E1&session=abcd1234&offset=38']);
});
