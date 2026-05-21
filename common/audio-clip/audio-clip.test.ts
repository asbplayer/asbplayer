import AudioClip from './audio-clip';
import { AudioErrorCode } from '@project/common';

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
