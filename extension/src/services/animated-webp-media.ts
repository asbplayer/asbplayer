import type {
    AudioModel,
    EncodeMp3InServiceWorkerMessage,
    ExtensionToOffscreenDocumentCommand,
    RecordMediaAndForwardSubtitleMessage,
} from '@project/common';
import type { SettingsProvider } from '@project/common/settings';
import { ensureOffscreenAudioServiceDocument } from '@project/extension/src/services/offscreen-document';
import { isFirefoxBuild } from '@project/extension/src/services/build-flags';
import { tabCaptureStreamId } from '@project/extension/src/services/video-capturer';

// An animated WebP is a recorded clip, so it needs media recording to be on. It also relies on
// chrome.tabCapture, which Firefox doesn't have.
export const shouldUseAnimatedWebp = async (
    settings: SettingsProvider,
    { screenshot, record }: { screenshot: boolean; record: boolean }
) => screenshot && record && !isFirefoxBuild && (await settings.getSingle('mediaFragmentFormat')) === 'webp';

// Everything needed to open a tab-capture stream for an animated WebP: a stream id plus the user's
// fps/quality settings.
export const negotiateAnimatedWebp = async (settings: SettingsProvider, tabId: number) => {
    const [fps, quality, streamId] = await Promise.all([
        settings.getSingle('animatedImageFps'),
        settings.getSingle('animatedImageQuality'),
        tabCaptureStreamId(tabId),
    ]);
    return { streamId, fps, quality };
};

// Build the audio model from the audio recorded alongside an animated WebP, encoding to mp3 when
// requested.
export const animatedWebpAudioModel = async (
    audioBase64: string | undefined,
    encodeAsMp3: boolean,
    timing: Pick<RecordMediaAndForwardSubtitleMessage, 'audioPaddingStart' | 'audioPaddingEnd' | 'playbackRate'>
): Promise<AudioModel> => {
    const { audioPaddingStart: paddingStart, audioPaddingEnd: paddingEnd, playbackRate } = timing;
    const base: AudioModel = {
        base64: '',
        extension: encodeAsMp3 ? 'mp3' : 'webm',
        paddingStart,
        paddingEnd,
        playbackRate,
    };

    if (!audioBase64) {
        return base;
    }

    if (!encodeAsMp3) {
        return { ...base, base64: audioBase64 };
    }

    return { ...base, base64: await encodeMp3(audioBase64) };
};

const encodeMp3 = async (audioBase64: string): Promise<string> => {
    await ensureOffscreenAudioServiceDocument();
    const command: ExtensionToOffscreenDocumentCommand<EncodeMp3InServiceWorkerMessage> = {
        sender: 'asbplayer-extension-to-offscreen-document',
        message: {
            command: 'encode-mp3',
            base64: audioBase64,
            extension: 'webm',
        },
    };
    return browser.runtime.sendMessage(command);
};
