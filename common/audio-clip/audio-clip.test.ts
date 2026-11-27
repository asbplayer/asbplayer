import AudioClip from '@project/common/audio-clip/audio-clip';
import { AudioErrorCode } from '@project/common';
import type { AudioModel, CardModel, FileModel } from '@project/common';
import { addBlobUrl } from '@project/common/blob-url';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';

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
        expect(
            clipFor({ name: 'a.mkv', blobUrl, transcodedAudio: { blobUrl: 'blob:gone-transcoded', complete: true } })
                .error
        ).toBe(AudioErrorCode.fileLinkLost);
    });

    it('does not depend on the file blob when transcoded audio is present', () => {
        const transcodedAudioBlobUrl = 'blob:live-transcoded';
        addBlobUrl(transcodedAudioBlobUrl);
        expect(
            clipFor({
                name: 'a.mkv',
                blobUrl: 'blob:gone-video',
                transcodedAudio: { blobUrl: transcodedAudioBlobUrl, complete: true },
            }).error
        ).toBeUndefined();
    });
});

describe('audio model from card', () => {
    beforeAll(() => {
        (globalThis as any).MediaRecorder = { isTypeSupported: () => true };
    });

    const cardFor = (file?: FileModel, audio?: AudioModel): CardModel => ({
        subtitle: { text: 'ねこ', start: 1000, end: 2000, originalStart: 1000, originalEnd: 2000, track: 0 },
        surroundingSubtitles: [],
        subtitleFileName: 'a.srt',
        mediaTimestamp: 0,
        file,
        audio,
    });

    it('reuses the serialized audio already on the card', async () => {
        const model = await AudioClip.audioModelFromCard(
            cardFor(undefined, { base64: base64Mp3, extension: 'mp3', paddingStart: 0, paddingEnd: 500 }),
            0,
            500
        );

        expect(model?.base64).toBe(base64Mp3);
        expect(model?.extension).toBe('mp3');
        expect(model?.error).toBeUndefined();
    });

    it('reports a lost file link instead of throwing', async () => {
        const model = await AudioClip.audioModelFromCard(cardFor({ name: 'a.mkv', blobUrl: 'blob:gone' }), 0, 500);

        expect(model?.base64).toBe('');
        expect(model?.error).toBe(AudioErrorCode.fileLinkLost);
    });

    it('reports the error carried by already-serialized audio', async () => {
        const model = await AudioClip.audioModelFromCard(
            cardFor(undefined, {
                base64: '',
                extension: 'webm',
                paddingStart: 0,
                paddingEnd: 0,
                error: AudioErrorCode.drmProtected,
            }),
            0,
            0
        );

        expect(model?.error).toBe(AudioErrorCode.drmProtected);
    });

    it('returns undefined when no conversion has emitted audio yet', async () => {
        const model = await AudioClip.audioModelFromCard(
            cardFor({
                name: 'a.mkv',
                blobUrl: 'blob:live-video',
                transcodedAudio: { blobUrl: undefined, complete: false },
            }),
            0,
            500
        );

        expect(model).toBeUndefined();
    });

    it('returns undefined for a card with no audio source', async () => {
        expect(await AudioClip.audioModelFromCard(cardFor(), 0, 500)).toBeUndefined();
    });
});
