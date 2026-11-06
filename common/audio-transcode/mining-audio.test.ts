/** @jest-environment node */
import { expect, it, jest } from '@jest/globals';
import { canMineWithAudio, snapshotMiningAudio, snapshotWebmAudio } from '@project/common/audio-transcode/mining-audio';
import type { TranscodedAudioPayload } from '@project/common';
import { webmHeader } from '@project/common/audio-transcode/test-host';
import { finalizeWebmAudio } from '@project/common/audio-transcode/webm-audio';

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

it('keeps an incomplete mining snapshot seekable without changing the original prefix', async () => {
    const audio = prefix(cluster(1000), cluster(2000).slice(0, -3));
    const snapshot = await snapshotMiningAudio({ audio, required: true, complete: false });
    expect(snapshot.durationMs).toBe(1040);
    const bytes = await snapshot.audio!.arrayBuffer();
    expect(new DataView(bytes).getFloat64(25)).toBe(1040);
    expect(new Uint8Array(await audio.slice(0, webmHeader.length).arrayBuffer())).toEqual(webmHeader);
});

it('does not fall back to the original audio before conversion emits a complete cluster', async () => {
    await expect(snapshotMiningAudio({ required: false, complete: false })).resolves.toEqual({ durationMs: 0 });
    await expect(snapshotMiningAudio({ required: true, complete: false })).resolves.toEqual({ durationMs: 0 });
    await expect(snapshotMiningAudio({ audio: prefix(), required: true, complete: false })).resolves.toEqual({
        durationMs: 0,
    });
});

it('uses the exact completed duration rather than the conservative partial boundary', async () => {
    const audio = await finalizeWebmAudio([prefix(cluster(1000))], 3.002);
    const snapshot = await snapshotMiningAudio({ audio, required: true, complete: true });
    expect(snapshot.durationMs).toBeCloseTo(3002);
    expect(snapshot.audio).toBe(audio);
});

it.each<[number, boolean]>([
    [39, true],
    [40, true],
    [41, false],
    [1040, false],
    [2000, false],
])('allows mining a subtitle ending at %i ms only with another second of converted audio', async (end, ready) => {
    const source: TranscodedAudioPayload = { audio: prefix(cluster(1000)), required: true, state: 'transcoding' };
    await expect(canMineWithAudio(source, end)).resolves.toBe(ready);
});

it('blocks mining until complete converted clusters reach the requested boundary', async () => {
    const audio = prefix(cluster(1000), cluster(2000).slice(0, -1));
    await expect(canMineWithAudio({ audio, required: true, state: 'transcoding' }, 1040)).resolves.toBe(false);
    await expect(
        canMineWithAudio({ audio: prefix(cluster(1000), cluster(2000)), required: true, state: 'transcoding' }, 1040)
    ).resolves.toBe(true);
});

it('blocks mining before converted audio is available without restricting ordinary audio', async () => {
    await expect(canMineWithAudio({ required: true, state: 'transcoding' }, 1000)).resolves.toBe(false);
    await expect(canMineWithAudio({ audio: prefix(), required: true, state: 'transcoding' }, 1000)).resolves.toBe(
        false
    );
    await expect(canMineWithAudio({ required: false, state: 'idle' }, 1000)).resolves.toBe(true);
});

it.each(['idle', 'failed'] as const)('allows text-only mining when required audio conversion is %s', async (state) => {
    await expect(canMineWithAudio({ required: true, state }, 1000)).resolves.toBe(true);
});

it('allows mining near the end of a completed file without requiring an extra second', async () => {
    const audio = await finalizeWebmAudio([prefix(cluster(1000))], 3.002);
    await expect(canMineWithAudio({ audio, required: true, state: 'ready' }, 3000)).resolves.toBe(true);
});
