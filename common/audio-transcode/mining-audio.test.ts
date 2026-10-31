/** @jest-environment node */
import {
    createMiningAudioSource,
    snapshotMiningAudio,
    snapshotWebmAudio,
} from '@project/common/audio-transcode/mining-audio';
import { webmHeader } from '@project/common/audio-transcode/test-host';
import { isActiveBlobUrl, revokeBlobUrl } from '@project/common/blob-url';
import { finalizeWebmAudio } from '@project/common/audio-transcode/webm-audio';
import AudioClip from '@project/common/audio-clip/audio-clip';

const concat = (...parts: Uint8Array[]) => {
    const bytes = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        bytes.set(part, offset);
        offset += part.length;
    }
    return bytes;
};
const element = (id: number[], data: Uint8Array) => {
    const size =
        data.length < 127
            ? [0x80 | data.length]
            : [0x20 | (data.length >> 16), (data.length >> 8) & 255, data.length & 255];
    return concat(new Uint8Array([...id, ...size]), data);
};
const cluster = (timestamp: number, group = false) => {
    const time = new Uint8Array(4);
    new DataView(time.buffer).setUint32(0, timestamp);
    const block = element([group ? 0xa1 : 0xa3], new Uint8Array([0x81, 0, 40, 0x80, 1, 2, 3]));
    return element([0x1f, 0x43, 0xb6, 0x75], concat(element([0xe7], time), group ? element([0xa0], block) : block));
};
const prefix = (...parts: Uint8Array[]) => new Blob([webmHeader, ...parts], { type: 'audio/webm' });

it.each([0, 1, 2])('snapshots %i complete clusters and discards an unfinished trailing cluster', async (count) => {
    const clusters = [cluster(0), cluster(1000, true)].slice(0, count);
    const unfinished = cluster(2000).slice(0, -1);
    const audio = prefix(...clusters, unfinished);
    const snapshot = await snapshotWebmAudio(audio);
    if (count === 0) {
        expect(snapshot).toBeUndefined();
        return;
    }
    expect(snapshot!.durationMs).toBe(count === 1 ? 40 : 1040);
    const bytes = new Uint8Array(await snapshot!.blob.arrayBuffer());
    expect(bytes.slice(webmHeader.length)).toEqual(concat(...clusters));
    expect(new DataView(bytes.buffer).getFloat64(25)).toBe(snapshot!.durationMs);
    expect(new Uint8Array(await audio.slice(0, webmHeader.length).arrayBuffer())).toEqual(webmHeader);
});

it('accounts for the timestamp scale and Opus codec delay', async () => {
    const header = webmHeader.slice();
    header.set([0x1e, 0x84, 0x80], 19); // 2,000,000 ns per tick
    const tracks = element(
        [0x16, 0x54, 0xae, 0x6b],
        element([0xae], element([0x56, 0xaa], new Uint8Array([0x63, 0x2e, 0xa0])))
    );
    const snapshot = await snapshotWebmAudio(new Blob([header, tracks, cluster(1000)]));
    expect(snapshot!.durationMs).toBe(2073.5);
});

it('walks large payloads with bounded reads and keeps the encoded payload unchanged', async () => {
    const padding = element([0xec], new Uint8Array(150_000));
    const audio = prefix(cluster(0), padding, cluster(1000));
    const slices = jest.spyOn(audio, 'slice');
    const snapshot = await snapshotWebmAudio(audio);
    expect(snapshot!.durationMs).toBe(1040);
    expect(new Uint8Array(await snapshot!.blob.slice(webmHeader.length).arrayBuffer())).toEqual(
        concat(cluster(0), padding, cluster(1000))
    );
    // Slice reads stay bounded; the final large slice shares immutable Blob storage.
    expect(
        slices.mock.calls
            .filter(([start]) => start !== 0 && start !== webmHeader.length)
            .every(([start, end]) => end! - start! <= 64 * 1024)
    ).toBe(true);
});

it('owns a seekable source for an incomplete card and leaves the original prefix unchanged', async () => {
    const audio = prefix(cluster(1000), cluster(2000).slice(0, -3));
    const source = createMiningAudioSource(await snapshotMiningAudio({ audio, required: true, complete: false }));
    expect(source.transcodedAudioDurationMs).toBe(1040);
    expect(isActiveBlobUrl(source.transcodedAudioBlobUrl!)).toBe(true);
    const bytes = new Uint8Array(await (await fetch(source.transcodedAudioBlobUrl!)).arrayBuffer());
    expect(new DataView(bytes.buffer).getFloat64(25)).toBe(1040);
    revokeBlobUrl(source.transcodedAudioBlobUrl!);
});

it('keeps text and screenshots usable before any audio has been emitted without falling back to Dolby', async () => {
    expect(createMiningAudioSource(await snapshotMiningAudio({ required: false, complete: false }))).toEqual({});
    expect(createMiningAudioSource(await snapshotMiningAudio({ required: true, complete: false }))).toEqual({
        transcodedAudioDurationMs: 0,
    });
    expect(
        createMiningAudioSource(await snapshotMiningAudio({ audio: prefix(), required: true, complete: false }))
    ).toEqual({
        transcodedAudioDurationMs: 0,
    });
});

it('uses the exact completed duration rather than the conservative partial boundary', async () => {
    const audio = await finalizeWebmAudio([prefix(cluster(1000))], 3.002);
    const source = createMiningAudioSource(await snapshotMiningAudio({ audio, required: true, complete: true }));
    expect(source.transcodedAudioDurationMs).toBeCloseTo(3002);
    expect(isActiveBlobUrl(source.transcodedAudioBlobUrl!)).toBe(true);
    const subtitle = { text: 'tail', start: 5000, end: 5500, originalStart: 5000, originalEnd: 5500, track: 0 };
    expect(
        AudioClip.fromCard(
            {
                file: { name: 'video.mp4', blobUrl: 'blob:video', ...source },
                subtitle,
                surroundingSubtitles: [],
                subtitleFileName: 'video.srt',
                mediaTimestamp: 5000,
            },
            0,
            0,
            false
        )
    ).toBeUndefined();
    expect(new Uint8Array(await (await fetch(source.transcodedAudioBlobUrl!)).arrayBuffer())).toEqual(
        new Uint8Array(await audio.arrayBuffer())
    );
    revokeBlobUrl(source.transcodedAudioBlobUrl!);
});

it('shares a fixed mining boundary while each document owns an independent source URL', async () => {
    const audio = prefix(cluster(1000), cluster(2000).slice(0, -3));
    const snapshot = await snapshotMiningAudio({ audio, required: true, complete: false });
    const dialog = createMiningAudioSource(snapshot);
    // History receives the captured snapshot even if more audio is converted before it handles the message.
    const newer = await snapshotMiningAudio({
        audio: prefix(cluster(1000), cluster(2000)),
        required: true,
        complete: false,
    });
    const history = createMiningAudioSource(structuredClone(snapshot));
    try {
        expect(newer.durationMs).toBe(2040);
        expect(dialog.transcodedAudioDurationMs).toBe(1040);
        expect(history.transcodedAudioDurationMs).toBe(dialog.transcodedAudioDurationMs);
        expect(history.transcodedAudioBlobUrl).not.toBe(dialog.transcodedAudioBlobUrl);
        const dialogBytes = await (await fetch(dialog.transcodedAudioBlobUrl!)).arrayBuffer();
        const historyBytes = await (await fetch(history.transcodedAudioBlobUrl!)).arrayBuffer();
        expect(new Uint8Array(historyBytes)).toEqual(new Uint8Array(dialogBytes));
        revokeBlobUrl(dialog.transcodedAudioBlobUrl!);
        expect(isActiveBlobUrl(history.transcodedAudioBlobUrl!)).toBe(true);
        await expect(fetch(history.transcodedAudioBlobUrl!)).resolves.toMatchObject({ ok: true });
    } finally {
        revokeBlobUrl(dialog.transcodedAudioBlobUrl!);
        revokeBlobUrl(history.transcodedAudioBlobUrl!);
    }
});
