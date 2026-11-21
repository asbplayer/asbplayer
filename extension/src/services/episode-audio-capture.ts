import type { CaptureEpisodeAudioMessage } from '@project/common';
import { localTranscriberUrl } from '@/services/local-transcriber';

// Streams the recording to the Whisper server as it happens: a whole season held in memory is lost if the extension
// restarts. Chrome runtime messages use JSON serialization, so blobs never leave the offscreen document.
const chunkMs = 30_000;
let capture: EpisodeAudioCapture | undefined;

class EpisodeAudioCapture {
    private readonly _abort = new AbortController();
    private readonly _unsent: Blob[] = [];
    private _sending?: Promise<void>;
    private _stream?: MediaStream;
    private _output?: AudioContext;
    private _recorder?: MediaRecorder;
    private _offset?: number;
    private _startTimeout = setTimeout(() => this.close(), 30_000);

    constructor(
        readonly id: string,
        readonly tabId: number,
        private readonly _key: string
    ) {}

    async open(getStream: () => Promise<MediaStream>) {
        const stream = await getStream();
        if (this._abort.signal.aborted) {
            stream.getTracks().forEach((track) => track.stop());
            this._abort.signal.throwIfAborted();
        }
        this._stream = stream;
        for (const track of stream.getAudioTracks()) {
            track.addEventListener('ended', () => this.close(), { once: true });
        }
        this._output = new AudioContext();
        this._output.createMediaStreamSource(stream).connect(this._output.destination);
        await this._output.resume();
        this._abort.signal.throwIfAborted();
        this._recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        this._recorder.addEventListener('dataavailable', ({ data }) => {
            if (data.size === 0) return;
            this._unsent.push(data);
            void this._send();
        });
    }

    resume(offset: number) {
        const recorder = this._recorder!;
        if (recorder.state === 'paused') recorder.resume();
        if (this._offset === undefined) {
            recorder.start(chunkMs);
            this._offset = offset;
            clearTimeout(this._startTimeout);
        }
    }

    pause() {
        if (this._recorder?.state === 'recording') this._recorder.pause();
    }

    async finish() {
        const recorder = this._recorder!;
        if (recorder.state === 'inactive' || this._offset === undefined) {
            throw new Error('No episode audio was recorded.');
        }

        await new Promise<void>((resolve) => {
            recorder.addEventListener('stop', () => resolve(), { once: true });
            recorder.stop();
        });
        this._releaseStream();
        for (let attempt = 0; attempt < 3 && this._unsent.length > 0; ++attempt) await this._send();
        if (this._unsent.length > 0) throw new Error('The Whisper server could not save the recording.');

        const url = localTranscriberUrl('transcribe', this._key);
        url.searchParams.set('session', this.id);
        url.searchParams.set('offset', String(this._offset));
        const response = await fetch(url, {
            method: 'POST',
            signal: AbortSignal.any([this._abort.signal, AbortSignal.timeout(25_000)]),
        });
        if (response.status !== 202) throw new Error('The Whisper server could not accept the recording.');
    }

    /** Appends the unsent chunks in order; a failed one stays first in line for the next attempt. */
    private _send(): Promise<void> {
        this._sending ??= (async () => {
            try {
                while (this._unsent.length > 0) {
                    const url = localTranscriberUrl('append', this._key);
                    url.searchParams.set('session', this.id);
                    // Not tied to close(): the last chunk still lands when the tab capture ends.
                    const response = await fetch(url, {
                        method: 'POST',
                        body: this._unsent[0],
                        signal: AbortSignal.timeout(25_000),
                    });
                    if (response.status !== 204) return;
                    this._unsent.shift();
                }
            } catch {
                // The server is down; retry with the next chunk.
            } finally {
                this._sending = undefined;
            }
        })();
        return this._sending;
    }

    close() {
        this._abort.abort();
        clearTimeout(this._startTimeout);
        if (this._recorder && this._recorder.state !== 'inactive') this._recorder.stop();
        this._releaseStream();
        if (capture === this) capture = undefined;
    }

    private _releaseStream() {
        this._stream?.getTracks().forEach((track) => track.stop());
        if (this._output?.state !== 'closed') void this._output?.close();
        this._output = undefined;
    }
}

export const episodeAudioCaptureActive = () => capture !== undefined;

export async function handleEpisodeAudioCapture(
    { id, tabId, operation }: CaptureEpisodeAudioMessage,
    getStream: () => Promise<MediaStream>,
    canStart: boolean
) {
    if (operation.action === 'start') {
        if (!canStart || capture) throw new Error('Another recording is already in progress.');
        const nextCapture = new EpisodeAudioCapture(id, tabId, operation.key);
        capture = nextCapture;
        try {
            await nextCapture.open(getStream);
        } catch (error) {
            nextCapture.close();
            throw error;
        }
        return;
    }

    if (capture?.id !== id || capture.tabId !== tabId) {
        if (operation.action === 'cancel') return;
        throw new Error('The tab audio capture ended. Start another pass to try again.');
    }

    switch (operation.action) {
        case 'resume':
            capture.resume(operation.offset);
            break;
        case 'pause':
            capture.pause();
            break;
        case 'finish': {
            const active = capture;
            try {
                await active.finish();
            } finally {
                active.close();
            }
            break;
        }
        case 'cancel':
            capture.close();
            break;
    }
}
