/** @jest-environment node */
import { transcodeAudioTrack } from '@project/common/audio-transcode/audio-transcoder';
import { TestHost, webmHeader } from '@project/common/audio-transcode/test-host';

const file = new File(['media'], 'video.mp4');
const run = (host: TestHost, owner = new AbortController()) =>
    transcodeAudioTrack({ file, trackIndex: 0, host, signal: owner.signal, onAudio: () => {} });

it('passes the File without reading the whole input and releases the worker', async () => {
    const host = new TestHost();
    const arrayBuffer = jest.spyOn(file, 'arrayBuffer');
    const result = await run(host);
    expect(new Uint8Array(await result.arrayBuffer()).slice(webmHeader.length)).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.type).toBe('audio/webm; codecs="opus"');
    expect(host.workers).toHaveLength(1);
    expect(host.workers[0].input).toBe(file);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(host.workers[0].active).toBe(false);
    arrayBuffer.mockRestore();
});

it('does not create a session for an already cancelled conversion', async () => {
    const host = new TestHost();
    const owner = new AbortController();
    owner.abort();
    await expect(run(host, owner)).rejects.toMatchObject({ name: 'AbortError' });
    expect(host.workers).toHaveLength(0);
});

it.each(['initializing', 'transcoding'])(
    'terminates %s work on cancellation and permits a fresh conversion',
    async (stage) => {
        const host = new TestHost();
        host.autoInitialize = stage !== 'initializing';
        host.autoComplete = false;
        const owner = new AbortController();
        const pending = run(host, owner);
        // The preparation boundary is async; wait for the worker to receive its first request.
        while (host.workers.length === 0) await new Promise((resolve) => setTimeout(resolve, 0));
        await host.workers[0].started;
        owner.abort();
        await expect(pending).rejects.toMatchObject({ code: 'aborted' });
        expect(host.workers).toHaveLength(1);
        expect(host.workers[0].active).toBe(false);
        host.autoInitialize = true;
        host.autoComplete = true;
        expect((await run(host)).size).toBe(webmHeader.length + 3);
        expect(host.workers).toHaveLength(2);
        expect(host.workers[1].active).toBe(false);
    }
);

it('releases a failed conversion and retries with a fresh session', async () => {
    const host = new TestHost();
    host.error = 'Unable to decode media';
    await expect(run(host)).rejects.toThrow('Unable to decode media');
    expect(host.workers[0].active).toBe(false);
    host.error = undefined;
    expect((await run(host)).size).toBe(webmHeader.length + 3);
    expect(host.workers).toHaveLength(2);
});

it('fails without starting a worker when WebM Opus playback is unsupported', async () => {
    const host = new TestHost();
    host.supportsAudioPlayback = () => false;
    await expect(run(host)).rejects.toThrow('WebM Opus playback is not supported');
    expect(host.workers).toHaveLength(0);
});

it('delivers audio before completion and never retries a failed Opus conversion with another codec', async () => {
    const host = new TestHost();
    host.autoComplete = false;
    const prefixes: Blob[] = [];
    const pending = transcodeAudioTrack({
        file,
        trackIndex: 0,
        host,
        signal: new AbortController().signal,
        onAudio: (audio) => prefixes.push(audio),
    });
    await new Promise(setImmediate);
    host.workers[0].chunk(new Uint8Array([4, 5]).buffer);
    expect(prefixes.map((audio) => audio.size)).toEqual([webmHeader.length, webmHeader.length + 2]);
    expect(new Uint8Array(await prefixes[0].arrayBuffer())).toEqual(webmHeader);
    expect(new Uint8Array(await prefixes[1].arrayBuffer()).slice(webmHeader.length)).toEqual(new Uint8Array([4, 5]));
    expect(host.workers[0].active).toBe(true);
    host.workers[0].complete();
    // Previously delivered prefixes stay immutable after more audio arrives.
    expect(prefixes[1].size).toBe(webmHeader.length + 2);
    expect(new Uint8Array(await (await pending).arrayBuffer()).slice(webmHeader.length)).toEqual(
        new Uint8Array([4, 5, 1, 2, 3])
    );
    host.error = 'Opus failed';
    host.autoComplete = true;
    await expect(run(host)).rejects.toThrow('Opus failed');
    expect(host.workers).toHaveLength(2);
    expect(host.workers.every((worker) => !worker.active)).toBe(true);
});
