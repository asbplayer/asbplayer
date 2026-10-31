/** @jest-environment node */
import { finalizeWebmAudio, readWebmAudioDuration } from '@project/common/audio-transcode/webm-audio';
import { webmHeader } from '@project/common/audio-transcode/test-host';

it('patches the completed duration without changing the streamed header or encoded media', async () => {
    const header = new Blob([webmHeader], { type: 'audio/webm' });
    const media = new Blob([new Uint8Array([1, 2, 3])]);
    const completed = await finalizeWebmAudio([header, media], 123.456);
    const bytes = new Uint8Array(await completed.arrayBuffer());
    expect(new DataView(bytes.buffer).getFloat64(25)).toBeCloseTo(123456);
    expect(bytes.slice(webmHeader.length)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(await header.arrayBuffer())).toEqual(webmHeader);
    expect(completed.type).toBe('audio/webm');
    expect(await readWebmAudioDuration(completed)).toBeCloseTo(123.456);
});

it.each([0, -1, NaN, Infinity])('rejects invalid completion duration %s', async (duration) => {
    await expect(finalizeWebmAudio([new Blob([webmHeader])], duration)).rejects.toThrow('Invalid Opus output duration');
});

it('rejects missing output and malformed initialization metadata', async () => {
    await expect(finalizeWebmAudio([], 1)).rejects.toThrow('Invalid Opus output duration');
    await expect(finalizeWebmAudio([new Blob([new Uint8Array([1, 2])])], 1)).rejects.toThrow('WebM');
});
