import type { CaptureEpisodeAudioMessage } from '@project/common';
import { localTranscriberUrl } from '@/services/local-transcriber';

// Keep episode-sized blobs in the offscreen document. Chrome runtime messages use JSON serialization.
let capture: EpisodeAudioCapture | undefined;

class EpisodeAudioCapture {
    private readonly _abort = new AbortController();
    private readonly _chunks: Blob[] = [];
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
            if (data.size > 0) this._chunks.push(data);
        });
    }

    resume(offset: number) {
        const recorder = this._recorder!;
        if (recorder.state === 'paused') recorder.resume();
        if (this._offset === undefined) {
            recorder.start(1000);
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
        const audio = new Blob(this._chunks, { type: 'audio/webm' });
        if (audio.size === 0) throw new Error('No episode audio was recorded.');

        const url = localTranscriberUrl('transcribe', this._key);
        url.searchParams.set('offset', String(this._offset));
        const response = await fetch(url, {
            method: 'POST',
            body: audio,
            signal: AbortSignal.any([this._abort.signal, AbortSignal.timeout(25_000)]),
        });
        if (response.status !== 202) throw new Error('The Whisper server could not accept the recording.');
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
