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

    it('starts recording when the video was already playing', async () => {
        Object.defineProperty(video, 'paused', { value: false, configurable: true });
        video.currentTime = 42;
        await transcription.start('episode', async () => {}, jest.fn<() => Promise<void>>());

        expect(actions()).toEqual([
            { action: 'start', key: 'episode' },
            { action: 'resume', offset: 42 },
        ]);
    });

    it('transcribes what was recorded when the viewer seeks', async () => {
        sendMessage.mockImplementation(async ({ message }) =>
            message.operation.action === 'status' ? { job: { state: 'done', progress: 1 } } : {}
        );
        let loaded: () => void;
        const subtitlesLoaded = new Promise<void>((resolve) => (loaded = resolve));
        const load = jest.fn<(key: string, signal: AbortSignal) => Promise<void>>(async () => loaded());
        await transcription.start('episode', play, load);
        video.dispatchEvent(new Event('seeking'));
        await subtitlesLoaded;

        expect(
            actions()
                .map(({ action }) => action)
                .slice(0, 4)
        ).toEqual(['start', 'resume', 'finish', 'status']);
        expect(load).toHaveBeenCalledWith('episode', expect.any(AbortSignal));
    });

    it('still submits the recording when the episode goes away, without cancelling the upload', async () => {
        const load = jest.fn<() => Promise<void>>();
        await transcription.start('episode', play, load);
        video.dispatchEvent(new Event('emptied'));
        await Promise.resolve();

        expect(actions().map(({ action }) => action)).toEqual(['start', 'resume', 'finish']);
        expect(load).not.toHaveBeenCalled();
        expect(transcription.state).toEqual({ phase: 'ready' });
    });

    it('does not cancel an upload in progress when the episode goes away', async () => {
        let uploaded: () => void = () => {};
        sendMessage.mockImplementation(({ message }) =>
            message.operation.action === 'finish'
                ? new Promise((resolve) => (uploaded = () => resolve({})))
                : Promise.resolve({})
        );
        await transcription.start('episode', play, jest.fn<() => Promise<void>>());
        video.dispatchEvent(new Event('ended'));
        transcription.stop();
        uploaded();

        expect(actions().map(({ action }) => action)).toEqual(['start', 'resume', 'finish']);
        expect(transcription.key).toBeUndefined();
    });

    it('continues onto the next episode from 0:00 under its own key', async () => {
        await transcription.start('E1', play, jest.fn<() => Promise<void>>());
        video.currentTime = 90; // autoplay skipped the intro
        const continued = transcription.continueOnto('E2', play, jest.fn<() => Promise<void>>());
        await new Promise((resolve) => setTimeout(resolve, 0)); // the previous episode's upload hands off first
        expect(video.currentTime).toBe(0);
        video.dispatchEvent(new Event('seeked'));
        await continued;

        expect(actions()).toEqual([
            { action: 'start', key: 'E1' },
            { action: 'resume', offset: 0 },
            { action: 'finish' },
            { action: 'start', key: 'E2' },
            { action: 'resume', offset: 0 },
        ]);
        expect(transcription.key).toBe('E2');
    });

    it('waits for the previous episode to upload before capturing the next one', async () => {
        let uploaded: () => void = () => {};
        sendMessage.mockImplementation(({ message }) =>
            message.operation.action === 'finish'
                ? new Promise((resolve) => (uploaded = () => resolve({})))
                : Promise.resolve({})
        );
        await transcription.start('E1', play, jest.fn<() => Promise<void>>());
        const continued = transcription.continueOnto('E2', play, jest.fn<() => Promise<void>>());
        await Promise.resolve();
        expect(actions().map(({ action }) => action)).toEqual(['start', 'resume', 'finish']);

        uploaded();
        await continued;
        expect(actions().map(({ action }) => action)).toEqual(['start', 'resume', 'finish', 'start', 'resume']);
    });

    it('uploads, never cancels, when the next episode loads the moment this one ends', async () => {
        await transcription.start('E1', play, jest.fn<() => Promise<void>>());
        Object.defineProperty(video, 'currentSrc', { value: 'blob:next-episode', configurable: true });
        video.dispatchEvent(new Event('pause'));
        video.dispatchEvent(new Event('ended'));
        await new Promise((resolve) => setTimeout(resolve, 0));

        const sent = actions().map(({ action }) => action);
        expect(sent).toContain('finish');
        expect(sent).not.toContain('cancel');
    });

    it('does not continue after the viewer cancels, finishes, or a pass fails', async () => {
        const next = () => transcription.continueOnto('E2', play, jest.fn<() => Promise<void>>());

        await transcription.start('E1', play, jest.fn<() => Promise<void>>());
        transcription.reset();
        await next();
        expect(transcription.key).toBeUndefined();

        await transcription.start('E1', play, jest.fn<() => Promise<void>>());
        transcription.finish();
        await next();
        expect(actions().filter(({ action }) => action === 'start')).toHaveLength(2);

        sendMessage.mockReset();
        sendMessage.mockRejectedValue(new Error('recorder broke'));
        transcription.reset();
        await transcription.start('E1', play, jest.fn<() => Promise<void>>());
        await next();
        expect(actions().filter(({ action }) => action === 'start')).toHaveLength(1);
    });

    it('never records the next episode under a name already recorded', async () => {
        await transcription.start('E1', play, jest.fn<() => Promise<void>>());
        transcription.stop(); // autoplay moved on before the episode name updated
        await transcription.continueOnto('E1', play, jest.fn<() => Promise<void>>());

        expect(actions().filter(({ action }) => action === 'start')).toHaveLength(1);
    });

    it('does not continue without a pass started by the viewer', async () => {
        await transcription.continueOnto('E2', play, jest.fn<() => Promise<void>>());
        expect(actions()).toEqual([]);
    });

    it('discards the recording when cancelled', async () => {
        await transcription.start('episode', play, jest.fn<() => Promise<void>>());
        transcription.reset();

        expect(actions().map(({ action }) => action)).toEqual(['start', 'resume', 'cancel']);
    });
});
