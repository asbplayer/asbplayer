import type {
    EpisodeTranscriptionAction,
    EpisodeTranscriptionMessage,
    EpisodeTranscriptionState,
    VideoToExtensionCommand,
} from '@project/common';
import { v4 as uuid } from 'uuid';
import type { TranscriptionResponse } from '@/services/local-transcriber';

type Pass = { id: string; abort: AbortController; location: string; src: string; key: string };

export class EpisodeTranscription {
    private _pass?: Pass;
    state: EpisodeTranscriptionState = { phase: 'ready' };

    constructor(
        private readonly _video: HTMLMediaElement,
        private readonly _registeredSrc: () => string,
        private readonly _update: (state: EpisodeTranscriptionState) => void
    ) {}

    async start(key: string, play: () => Promise<void>, load: (key: string, signal: AbortSignal) => Promise<void>) {
        if (this._pass) return;
        const video = this._video;
        if (video.playbackRate !== 1 || video.seeking || video.ended) {
            this._setState({ phase: 'error', error: 'Set playback to 1× and choose a starting point in the episode.' });
            return;
        }

        const pass = { id: uuid(), abort: new AbortController(), key, location: location.href, src: video.currentSrc };
        const signal = pass.abort.signal;
        this._pass = pass;
        this._setState({ phase: 'starting' });
        window.addEventListener('pagehide', () => this.reset(), { signal });
        video.addEventListener('emptied', () => this.reset(), { signal });

        try {
            await this._send(pass, { action: 'start', key });
            // The initial cancellation can arrive before the offscreen recorder has opened.
            if (signal.aborted) {
                await this._send(pass, { action: 'cancel' });
                return;
            }
            this._checkPass(pass);

            const updateRecorder = (operation: EpisodeTranscriptionAction) => {
                try {
                    this._checkPass(pass);
                } catch (error) {
                    this._fail(pass, error);
                    return;
                }
                void this._send(pass, operation).catch((error) => this._fail(pass, error));
            };
            const playbackListeners = new AbortController();
            signal.addEventListener('abort', () => playbackListeners.abort(), { once: true });
            const options = { signal: playbackListeners.signal };
            video.addEventListener(
                'playing',
                () => updateRecorder({ action: 'resume', offset: video.currentTime }),
                options
            );
            const pause = () => updateRecorder({ action: 'pause' });
            video.addEventListener('pause', pause, options);
            video.addEventListener('waiting', pause, options);
            const invalidate = () =>
                this._fail(pass, new Error('Playback moved or changed speed. Start a new pass at 1×.'));
            video.addEventListener('seeking', invalidate, options);
            video.addEventListener('ratechange', invalidate, options);

            this._finish = () => {
                playbackListeners.abort();
                this._finish = undefined;
                void this._finishPass(pass, load).catch((error) => this._fail(pass, error));
            };
            video.addEventListener('ended', this._finish, options);
            this._setState({ phase: 'recording' });
            await play();
        } catch (error) {
            this._fail(pass, error);
        }
    }

    private _finish?: () => void;

    finish() {
        this._finish?.();
    }

    resetIfLocationChanged() {
        if (this._pass && this._pass.location !== location.href) this.reset();
    }

    reset() {
        this._release();
        this._setState({ phase: 'ready' });
    }

    private async _finishPass(pass: Pass, load: (key: string, signal: AbortSignal) => Promise<void>) {
        this._checkPass(pass);
        this._setState({ phase: 'uploading' });
        await this._send(pass, { action: 'finish' });

        const deadline = Date.now() + 60 * 60_000;
        while (Date.now() < deadline) {
            this._checkPass(pass);
            const { job } = await this._send(pass, { action: 'status', key: pass.key });
            this._checkPass(pass);
            if (!job) throw new Error('The Whisper server lost the transcription job.');
            if (job.state === 'error') throw new Error(job.error || 'Whisper could not transcribe the episode.');
            if (job.state === 'done') {
                await load(pass.key, pass.abort.signal);
                this._checkPass(pass);
                this._release();
                this._setState({ phase: 'done' });
                return;
            }
            this._setState({ phase: 'transcribing', progress: job.progress });
            await new Promise<void>((resolve) => setTimeout(resolve, 2000));
        }
        throw new Error('Whisper is taking too long to respond.');
    }

    private _checkPass(pass: Pass) {
        if (pass.abort.signal.aborted) throw pass.abort.signal.reason;
        if (location.href !== pass.location || this._video.currentSrc !== pass.src || !this._video.isConnected) {
            throw new Error('The episode changed during transcription.');
        }
    }

    private _fail(pass: Pass, error: unknown) {
        if (this._pass !== pass) return;
        this._release();
        this._setState({ phase: 'error', error: error instanceof Error ? error.message : String(error) });
    }

    private _release() {
        const pass = this._pass;
        this._pass = undefined;
        this._finish = undefined;
        if (pass) {
            pass.abort.abort();
            void this._send(pass, { action: 'cancel' }).catch(() => {});
        }
    }

    private _setState(state: EpisodeTranscriptionState) {
        this.state = state;
        this._update(state);
    }

    private async _send(pass: Pass, operation: EpisodeTranscriptionAction): Promise<TranscriptionResponse> {
        const command: VideoToExtensionCommand<EpisodeTranscriptionMessage> = {
            sender: 'asbplayer-video',
            src: this._registeredSrc(),
            message: { command: 'episode-transcription', id: pass.id, operation },
        };
        const response: TranscriptionResponse | undefined = await browser.runtime.sendMessage(command);
        if (!response) throw new Error('The extension could not reach the tab audio recorder.');
        if (response.error) throw new Error(response.error);
        return response;
    }
}
