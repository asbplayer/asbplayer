import type {
    EpisodeTranscriptionAction,
    EpisodeTranscriptionMessage,
    EpisodeTranscriptionState,
    VideoToExtensionCommand,
} from '@project/common';
import { v4 as uuid } from 'uuid';
import type { TranscriptionResponse } from '@/services/local-transcriber';

type Pass = { id: string; abort: AbortController; location: string; src: string; key: string };

const episodeChanged = 'The episode changed during transcription.';
// Module-level so it survives Prime swapping the <video> element (and so this controller) between episodes.
let continueOntoNextEpisodes = false;
// Episodes recorded since the viewer clicked: a stale episode name must not record the next episode over this one.
const recordedKeys = new Set<string>();
// Settles once the last finished recording has uploaded and released the tab capture; Chrome allows one at a time.
let handoff: Promise<unknown> = Promise.resolve();

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
        continueOntoNextEpisodes = true;
        if (!this._continuing) recordedKeys.clear();
        recordedKeys.add(key);
        if (video.playbackRate !== 1 || video.seeking || video.ended) {
            continueOntoNextEpisodes = false;
            this._setState({ phase: 'error', error: 'Set playback to 1× and choose a starting point in the episode.' });
            return;
        }

        const pass = { id: uuid(), abort: new AbortController(), key, location: location.href, src: video.currentSrc };
        const signal = pass.abort.signal;
        this._pass = pass;
        this._setState({ phase: 'starting' });
        window.addEventListener('pagehide', () => this.stop(), { signal });
        video.addEventListener('emptied', () => this.stop(), { signal });

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
            // Audio after a seek or speed change no longer lines up with the video, so transcribe what came before.
            const finishEarly = () => this._finish?.();
            video.addEventListener('seeking', finishEarly, options);
            video.addEventListener('ratechange', finishEarly, options);

            this._finish = () => {
                playbackListeners.abort();
                this._finish = undefined;
                void this._finishPass(pass, load).catch((error) => this._fail(pass, error));
            };
            video.addEventListener('ended', this._finish, options);
            this._setState({ phase: 'recording' });
            await play();
            // A video that was already playing fires no 'playing' event, so the recorder would never start.
            if (!video.paused) updateRecorder({ action: 'resume', offset: video.currentTime });
        } catch (error) {
            this._fail(pass, error);
        }
    }

    private _finish?: () => void;

    /** The viewer ends the pass: transcribe it, and don't continue onto the next episode. */
    finish() {
        continueOntoNextEpisodes = false;
        this._finish?.();
    }

    /**
     * Starts a pass for an episode that autoplay moved on to, from 0:00, if the viewer started one on an earlier
     * episode and hasn't finished or cancelled since.
     */
    async continueOnto(
        key: string,
        play: () => Promise<void>,
        load: (key: string, signal: AbortSignal) => Promise<void>
    ) {
        if (!continueOntoNextEpisodes || recordedKeys.has(key) || this._continuing) return;
        this._continuing = true;
        try {
            this.stop();
            await handoff;
            const video = this._video;
            // Autoplay can land after the intro. Seek before the pass starts, so the seek doesn't end it.
            if (video.currentTime > 5) {
                const seeked = new Promise((resolve) => video.addEventListener('seeked', resolve, { once: true }));
                video.currentTime = 0;
                await seeked;
            }
            if (continueOntoNextEpisodes) await this.start(key, play, load);
        } finally {
            this._continuing = false;
        }
    }

    private _continuing = false;

    get key() {
        return this._pass?.key;
    }

    stopIfLocationChanged() {
        if (this._pass && this._pass.location !== location.href) this.stop();
    }

    /** Ends the pass because the episode went away (e.g. autoplay moved on), still transcribing what was recorded. */
    stop() {
        const pass = this._pass;
        if (!pass || this.state.phase === 'starting') {
            this._release();
            this._setState({ phase: 'ready' });
            return;
        }
        const recording = this._finish !== undefined;
        this._pass = undefined;
        this._finish = undefined;
        pass.abort.abort();
        // Never 'cancel' here: the offscreen recorder uploads on its own, and a cancel would abort the upload.
        if (recording) handoff = this._send(pass, { action: 'finish' }).catch(() => {});
        this._setState({ phase: 'ready' });
    }

    /** Ends the pass, discards the recording and stops continuing onto the next episodes. */
    reset() {
        continueOntoNextEpisodes = false;
        this._release();
        this._setState({ phase: 'ready' });
    }

    private async _finishPass(pass: Pass, load: (key: string, signal: AbortSignal) => Promise<void>) {
        // No episode check here: Prime can switch to the next episode the moment this one ends, and the recording
        // belongs to this one either way.
        if (pass.abort.signal.aborted) throw pass.abort.signal.reason;
        this._setState({ phase: 'uploading' });
        const finished = this._send(pass, { action: 'finish' });
        handoff = finished.catch(() => {});
        await finished;

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
            throw new Error(episodeChanged);
        }
    }

    private _fail(pass: Pass, error: unknown) {
        if (this._pass !== pass) return;
        const message = error instanceof Error ? error.message : String(error);
        if (message === episodeChanged) {
            this.stop(); // keep what was recorded rather than discarding it
            return;
        }
        this._release();
        continueOntoNextEpisodes = false; // a real failure would repeat on every episode
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
