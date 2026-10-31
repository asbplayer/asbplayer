import AudioClip from '@project/common/audio-clip/audio-clip';
import { AudioErrorCode } from '@project/common';
import type { FileModel } from '@project/common';
import { addBlobUrl } from '@project/common/blob-url';
import { expect, it, jest } from '@jest/globals';

// Mock the download utility so tests don't touch the DOM
jest.mock('@project/common/util', () => ({
    download: jest.fn(),
}));

import { download } from '@project/common/util';

const base64Mp3 =
    'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//8AAAA';

function makeAudioClip(error?: AudioErrorCode) {
    return AudioClip.fromBase64('subtitle_file.srt', 1000, 3000, 1, base64Mp3, 'mp3', error);
}

it('download calls the download utility with the blob and clip name', async () => {
    const clip = makeAudioClip();
    await clip.download();

    expect(download).toHaveBeenCalledTimes(1);
    const [blob, name] = (download as jest.Mock).mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(name).toBe(clip.name);
});

it('download uses the audio clip name which includes the extension', () => {
    const clip = makeAudioClip();
    expect(clip.name).toMatch(/\.mp3$/);
});

it('download resolves even when the audio clip has an error flag', async () => {
    const clip = makeAudioClip(AudioErrorCode.fileLinkLost);
    // Should not throw – the blob is still available from base64
    await expect(clip.download()).resolves.toBeUndefined();
});

it('download calls download once per invocation', async () => {
    const clip = makeAudioClip();
    const mockDownload = download as jest.Mock;
    mockDownload.mockClear();

    await clip.download();
    await clip.download();

    expect(mockDownload).toHaveBeenCalledTimes(2);
});

describe('audio clips from a file', () => {
    beforeAll(() => {
        // jsdom has no MediaRecorder, which AudioClip consults to pick a recording format
        (globalThis as any).MediaRecorder = { isTypeSupported: () => true };
    });

    const clipFor = (file: FileModel) => AudioClip.fromFile(file, 0, 1000, 1, false, undefined);

    it('reports no error while the file blob is alive', () => {
        const blobUrl = 'blob:live-video';
        addBlobUrl(blobUrl);
        expect(clipFor({ name: 'a.mkv', blobUrl }).error).toBeUndefined();
    });

    it('reports a lost link once the file blob is gone', () => {
        expect(clipFor({ name: 'a.mkv', blobUrl: 'blob:never-registered' }).error).toBe(AudioErrorCode.fileLinkLost);
    });

    // Audio is recorded from the transcoded track when there is one, so that is the blob whose
    // lifetime matters - the file's own audio track can't be decoded by this browser at all.
    it('depends on the transcoded audio blob when one is present', () => {
        const blobUrl = 'blob:live-video-2';
        addBlobUrl(blobUrl);
        expect(clipFor({ name: 'a.mkv', blobUrl, transcodedAudioBlobUrl: 'blob:gone-transcoded' }).error).toBe(
            AudioErrorCode.fileLinkLost
        );
    });

    it('does not depend on the file blob when transcoded audio is present', () => {
        const transcodedAudioBlobUrl = 'blob:live-transcoded';
        addBlobUrl(transcodedAudioBlobUrl);
        expect(clipFor({ name: 'a.mkv', blobUrl: 'blob:gone-video', transcodedAudioBlobUrl }).error).toBeUndefined();
    });

    it('limits padding and subsequent boundary edits to the audio snapshot', () => {
        const file = { name: 'a.mkv', blobUrl: 'blob:video', transcodedAudioDurationMs: 2500 };
        const card = {
            file,
            subtitle: { text: 'line', start: 1000, end: 2400, originalStart: 1000, originalEnd: 2400, track: 0 },
            surroundingSubtitles: [],
            subtitleFileName: 'a.srt',
            mediaTimestamp: 1000,
        };
        const clip = AudioClip.fromCard(card, 1500, 1000, false)!;
        expect([clip.start, clip.end]).toEqual([0, 2500]);
        expect([clip.slice(2000, 5000).start, clip.slice(2000, 5000).end]).toEqual([2000, 2500]);
        expect(
            AudioClip.fromCard({ ...card, file: { ...file, transcodedAudioDurationMs: 0 } }, 0, 0, false)
        ).toBeUndefined();
        expect(
            AudioClip.fromCard({ ...card, subtitle: { ...card.subtitle, start: 3000 } }, 0, 0, false)
        ).toBeUndefined();
    });

    it('rejects recording outside a snapshot instead of recording silence from the original Dolby track', async () => {
        const clip = AudioClip.fromFile(
            { name: 'a.mkv', blobUrl: 'blob:video', transcodedAudioDurationMs: 2500 },
            3000,
            5000,
            1,
            false
        );
        expect([clip.start, clip.end]).toEqual([2500, 2500]);
        await expect(clip.blob()).rejects.toThrow('outside the converted portion');
        await expect(clip.play()).rejects.toThrow('outside the converted portion');
    });
});
