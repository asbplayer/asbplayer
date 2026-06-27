import { JpegFileMediaFragmentData } from './jpeg-file-media-fragment-data';
import { CancelledMediaFragmentDataRenderingError, createVideoElement } from './media-fragment';
import { FileModel } from './model';

jest.mock('./media-fragment', () => {
    const actual = jest.requireActual('./media-fragment');
    return {
        ...actual,
        createVideoElement: jest.fn(),
        disposeVideoElement: jest.fn(),
    };
});

type Listener = (event: Event) => void;

class MockVideoElement {
    duration = 30;
    videoWidth = 320;
    videoHeight = 180;
    error?: { message?: string };
    seekedListenersWhenCurrentTimeSet = 0;
    errorListenersWhenCurrentTimeSet = 0;

    private _currentTime = 0;
    private _listeners = new Map<string, Set<Listener>>();

    get currentTime() {
        return this._currentTime;
    }

    set currentTime(value: number) {
        this.seekedListenersWhenCurrentTimeSet = this.listenerCount('seeked');
        this.errorListenersWhenCurrentTimeSet = this.listenerCount('error');
        this._currentTime = value;
    }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (!this._listeners.has(type)) {
            this._listeners.set(type, new Set());
        }

        this._listeners.get(type)!.add(toListener(listener));
    }

    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        this._listeners.get(type)?.delete(toListener(listener));
    }

    dispatch(type: string) {
        const event = new Event(type);
        for (const listener of [...(this._listeners.get(type) ?? [])]) {
            listener(event);
        }
    }

    listenerCount(type: string) {
        return this._listeners.get(type)?.size ?? 0;
    }
}

const toListener = (listener: EventListenerOrEventListenerObject): Listener => {
    if (typeof listener === 'function') {
        return listener;
    }

    return (event) => listener.handleEvent(event);
};

const flushAsync = async () =>
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });

const file: FileModel = {
    name: 'sample.mp4',
    blobUrl: 'blob:sample',
};

const mediaFragmentDataUrl = 'data:image/jpeg;base64,dGVzdA==';

const mockCanvasCreation = () => {
    const ctx = {
        drawImage: jest.fn(),
    } as unknown as CanvasRenderingContext2D;

    const canvas = {
        width: 0,
        height: 0,
        getContext: jest.fn(() => ctx),
        toDataURL: jest.fn(() => mediaFragmentDataUrl),
        toBlob: jest.fn(),
        remove: jest.fn(),
    } as unknown as HTMLCanvasElement;

    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
        if (tagName.toLowerCase() === 'canvas') {
            return canvas as unknown as HTMLElement;
        }

        return originalCreateElement(tagName);
    }) as any);
};

afterEach(() => {
    jest.restoreAllMocks();
});

it('retries rendering after createVideoElement failure', async () => {
    const createVideoElementMock = createVideoElement as jest.MockedFunction<typeof createVideoElement>;
    const video = new MockVideoElement();

    createVideoElementMock.mockRejectedValueOnce(new Error('create video failed'));
    createVideoElementMock.mockResolvedValue(video as unknown as HTMLVideoElement);
    mockCanvasCreation();

    const data = new JpegFileMediaFragmentData(file, 2_000, 0, 0);

    await expect(data.dataUrl()).rejects.toThrow('create video failed');

    const retryPromise = data.dataUrl();
    await flushAsync();
    video.dispatch('seeked');

    await expect(retryPromise).resolves.toEqual(mediaFragmentDataUrl);
    expect(createVideoElementMock).toHaveBeenCalledTimes(2);
});

it('cancels in-flight rendering on timestamp change and allows old instance retry', async () => {
    const createVideoElementMock = createVideoElement as jest.MockedFunction<typeof createVideoElement>;
    const video = new MockVideoElement();

    createVideoElementMock.mockResolvedValue(video as unknown as HTMLVideoElement);
    mockCanvasCreation();

    const data = new JpegFileMediaFragmentData(file, 1_000, 0, 0);

    const inFlightPromise = data.dataUrl();
    await flushAsync();
    const updated = data.atTimestamp(2_000);

    expect(updated.timestamp).toEqual(2_000);
    await expect(inFlightPromise).rejects.toBeInstanceOf(CancelledMediaFragmentDataRenderingError);
    expect(video.listenerCount('seeked')).toEqual(0);
    expect(video.listenerCount('error')).toEqual(0);

    const retryPromise = data.dataUrl();
    await flushAsync();
    video.dispatch('seeked');

    await expect(retryPromise).resolves.toEqual(mediaFragmentDataUrl);
});

it('registers seek listeners before seeking and clears listeners after render settles', async () => {
    const createVideoElementMock = createVideoElement as jest.MockedFunction<typeof createVideoElement>;
    const video = new MockVideoElement();

    createVideoElementMock.mockResolvedValue(video as unknown as HTMLVideoElement);
    mockCanvasCreation();

    const data = new JpegFileMediaFragmentData(file, 1_500, 0, 0);

    const renderPromise = data.dataUrl();
    await flushAsync();

    expect(video.seekedListenersWhenCurrentTimeSet).toBeGreaterThan(0);
    expect(video.errorListenersWhenCurrentTimeSet).toBeGreaterThan(0);

    video.dispatch('seeked');
    await expect(renderPromise).resolves.toEqual(mediaFragmentDataUrl);

    expect(video.listenerCount('seeked')).toEqual(0);
    expect(video.listenerCount('error')).toEqual(0);
    expect(video.listenerCount('loadedmetadata')).toEqual(0);
});
