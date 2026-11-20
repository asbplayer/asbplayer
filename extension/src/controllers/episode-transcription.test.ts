import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { EpisodeTranscriptionMessage } from '@project/common';
import type { TranscriptionResponse } from '@/services/local-transcriber';
import { EpisodeTranscription } from '@/controllers/episode-transcription';

describe('EpisodeTranscription', () => {
    const sendMessage =
        jest.fn<(command: { message: EpisodeTranscriptionMessage }) => Promise<TranscriptionResponse>>();
    const update = jest.fn();
    let video: HTMLVideoElement;
    let transcription: EpisodeTranscription;

    beforeEach(() => {
        video = document.body.appendChild(document.createElement('video'));
        transcription = new EpisodeTranscription(video, () => 'video', update);
        Object.assign(globalThis, { browser: { runtime: { sendMessage } } });
        sendMessage.mockReset();
        sendMessage.mockResolvedValue({});
        update.mockReset();
    });

    afterEach(() => {
        transcription.reset();
        video.remove();
        Reflect.deleteProperty(globalThis, 'browser');
    });

    const actions = () => sendMessage.mock.calls.map(([command]) => command.message.operation);
    const play = async () => {
        video.dispatchEvent(new Event('playing'));
    };

    it('pauses the recorder for buffering and submits the captured audio when playback ends', async () => {
        video.currentTime = 15;
        sendMessage.mockImplementation(async ({ message }) =>
            message.operation.action === 'status' ? { job: { state: 'done', progress: 1 } } : {}
        );
        let loaded: () => void;
        const subtitlesLoaded = new Promise<void>((resolve) => (loaded = resolve));
        const load = jest.fn<(key: string, signal: AbortSignal) => Promise<void>>(async () => loaded());
        await transcription.start('episode', play, load);
        expect(transcription.state).toEqual({ phase: 'recording' });
        video.dispatchEvent(new Event('waiting'));
        await play();
        video.dispatchEvent(new Event('ended'));
        await subtitlesLoaded;

        expect(actions().slice(0, 6)).toEqual([
            { action: 'start', key: 'episode' },
            { action: 'resume', offset: 15 },
            { action: 'pause' },
            { action: 'resume', offset: 15 },
            { action: 'finish' },
            { action: 'status', key: 'episode' },
        ]);
        expect(load).toHaveBeenCalledWith('episode', expect.any(AbortSignal));
    });

    it('discards an interrupted pass when the viewer seeks', async () => {
        const load = jest.fn<() => Promise<void>>();
        await transcription.start('episode', play, load);
        video.dispatchEvent(new Event('seeking'));
        video.dispatchEvent(new Event('ended'));

        expect(actions().map(({ action }) => action)).toEqual(['start', 'resume', 'cancel']);
        expect(load).not.toHaveBeenCalled();
        expect(update).toHaveBeenLastCalledWith({ phase: 'error', error: expect.stringContaining('Playback moved') });
    });
});
