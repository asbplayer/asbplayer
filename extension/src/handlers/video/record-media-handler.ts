import { asbError } from '@project/common/util';
import type ImageCapturer from '@project/extension/src/services/image-capturer';
import type {
    AudioModel,
    Command,
    ImageModel,
    Message,
    RecordMediaAndForwardSubtitleMessage,
    VideoToExtensionCommand,
    ExtensionToVideoCommand,
    ExtensionToOffscreenDocumentCommand,
    ScreenshotTakenMessage,
    RecordingFinishedMessage,
    EncodeMp3InServiceWorkerMessage,
    CardModel,
} from '@project/common';
import { AudioErrorCode, ImageErrorCode, PostMineAction } from '@project/common';
import type { SettingsProvider } from '@project/common/settings';
import type { CardPublisher } from '@project/extension/src/services/card-publisher';
import type AudioRecorderService from '@project/extension/src/services/audio-recorder-service';
import { DrmProtectedStreamError } from '@project/extension/src/services/audio-recorder-service';
import { recordAnimatedWebp, tabCaptureStreamId } from '@project/extension/src/services/video-capturer';
import { ensureOffscreenAudioServiceDocument } from '@project/extension/src/services/offscreen-document';
import { isFirefoxBuild } from '@project/extension/src/services/build-flags';

export default class RecordMediaHandler {
    private readonly _audioRecorder: AudioRecorderService;
    private readonly _imageCapturer: ImageCapturer;
    private readonly _cardPublisher: CardPublisher;
    private readonly _settingsProvider: SettingsProvider;

    constructor(
        audioRecorder: AudioRecorderService,
        imageCapturer: ImageCapturer,
        cardPublisher: CardPublisher,
        settingsProvider: SettingsProvider
    ) {
        this._audioRecorder = audioRecorder;
        this._imageCapturer = imageCapturer;
        this._cardPublisher = cardPublisher;
        this._settingsProvider = settingsProvider;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'record-media-and-forward-subtitle';
    }

    async handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const recordMediaCommand = command as VideoToExtensionCommand<RecordMediaAndForwardSubtitleMessage>;
        await this._recordAndForward(recordMediaCommand, sender);
    }

    private async _recordAndForward(
        recordMediaCommand: VideoToExtensionCommand<RecordMediaAndForwardSubtitleMessage>,
        sender: Browser.runtime.MessageSender
    ) {
        const message = recordMediaCommand.message;
        const subtitle = message.subtitle;
        const src = recordMediaCommand.src;
        let audioPromise: Promise<string> | undefined;
        let imagePromise: Promise<string> | undefined;
        let imageModel: ImageModel | undefined = undefined;
        let audioModel: AudioModel | undefined = undefined;
        let encodeAsMp3 = false;

        const tabId = sender.tab?.id;
        if (tabId === undefined) throw new Error('Cannot record media without a valid tab ID');

        // Capture window (subtitle duration adjusted for playback rate + padding), shared by audio
        // recording and the animated-WebP capture.
        const windowMs = (subtitle.end - subtitle.start) / message.playbackRate + message.audioPaddingEnd;

        // Animated WebP is Chrome-only (relies on chrome.tabCapture) and captures audio together with
        // the video in a single stream rather than via the offscreen audio recorder.
        const mediaFragmentFormat = message.screenshot
            ? await this._settingsProvider.getSingle('mediaFragmentFormat')
            : 'jpeg';
        const useAnimatedWebp = message.screenshot && mediaFragmentFormat === 'webp' && !isFirefoxBuild;

        if (message.record && message.postMineAction !== PostMineAction.showAnkiDialog) {
            encodeAsMp3 = await this._settingsProvider.getSingle('preferMp3');
        }

        if (message.record && !useAnimatedWebp) {
            audioPromise = this._audioRecorder.startWithTimeout(windowMs, encodeAsMp3, {
                src,
                tabId,
            });
        }

        if (useAnimatedWebp) {
            const { maxWidth, maxHeight, rect, frameId } = message;
            const fps = await this._settingsProvider.getSingle('animatedImageFps');
            const quality = await this._settingsProvider.getSingle('animatedImageQuality');

            try {
                const streamId = await tabCaptureStreamId(tabId);
                const { base64, audioBase64 } = await recordAnimatedWebp(
                    tabId,
                    src,
                    streamId,
                    windowMs,
                    fps,
                    quality,
                    message.record,
                    { maxWidth, maxHeight, rect, frameId }
                );
                imageModel = {
                    base64,
                    extension: 'webp',
                    error: base64 ? undefined : ImageErrorCode.captureFailed,
                };

                if (message.record) {
                    audioModel = await this._buildAnimatedAudioModel(audioBase64, encodeAsMp3, message);
                }
            } catch (e) {
                asbError('recording/animated-webp', e);
                imageModel = { base64: '', extension: 'webp', error: ImageErrorCode.captureFailed };
            }

            // We bypassed the audio recorder and the screenshot path, which normally emit these. Send
            // them so the binding leaves recording state (recording-finished) and restores the
            // subtitles/controls hidden for a clean screenshot (screenshot-taken).
            this._notifyRecordingFinished(src, tabId);
            this._notifyScreenshotTaken(src, tabId);
        } else if (message.screenshot) {
            const { maxWidth, maxHeight, rect, frameId } = message;
            const screenshotDelay = Math.max(
                0,
                message.record
                    ? message.mediaTimestamp - subtitle.start + message.audioPaddingStart
                    : message.imageDelay
            );
            imagePromise = this._imageCapturer.capture(tabId, src, screenshotDelay, {
                maxWidth,
                maxHeight,
                rect,
                frameId,
            });
            void imagePromise.finally(() => this._notifyScreenshotTaken(src, tabId));
        }

        if (audioPromise) {
            const { audioPaddingStart: paddingStart, audioPaddingEnd: paddingEnd, playbackRate } = message;
            const baseAudioModel: AudioModel = {
                base64: '',
                extension: encodeAsMp3 ? 'mp3' : 'webm',
                paddingStart,
                paddingEnd,
                playbackRate,
            };

            try {
                const audioBase64 = await audioPromise;
                audioModel = {
                    ...baseAudioModel,
                    base64: audioBase64,
                };
            } catch (e) {
                if (!(e instanceof DrmProtectedStreamError)) {
                    throw e;
                }

                audioModel = {
                    ...baseAudioModel,
                    error: AudioErrorCode.drmProtected,
                };
            }
        }

        if (imagePromise) {
            try {
                await imagePromise;
                // Use the last screenshot taken to allow re-taking while audio records.
                imageModel = {
                    base64: this._imageCapturer.lastImageBase64!,
                    extension: 'jpeg',
                };
            } catch (e) {
                asbError('recording/screenshot', e);
                imageModel = {
                    base64: '',
                    extension: 'jpeg',
                    error: ImageErrorCode.captureFailed,
                };
            }
        }

        const { isBulkExport, noteId, ...messageWithoutBulkFlag } = message;
        const card: CardModel = {
            image: imageModel,
            audio: audioModel,
            ...messageWithoutBulkFlag,
        };

        if (isBulkExport) {
            void this._cardPublisher.publishBulk(card, tabId, src);
        } else {
            void this._cardPublisher.publish(card, message.postMineAction, tabId, src, noteId);
        }
    }

    // Build the audio model from the audio captured alongside the animated WebP, encoding to mp3 when
    // requested.
    private async _buildAnimatedAudioModel(
        audioBase64: string | undefined,
        encodeAsMp3: boolean,
        message: RecordMediaAndForwardSubtitleMessage
    ): Promise<AudioModel> {
        const { audioPaddingStart: paddingStart, audioPaddingEnd: paddingEnd, playbackRate } = message;
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

        const mp3Base64 = await this._encodeMp3(audioBase64);
        return { ...base, base64: mp3Base64 };
    }

    private async _encodeMp3(audioBase64: string): Promise<string> {
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
    }

    private _notifyScreenshotTaken(src: string, tabId: number) {
        const command: ExtensionToVideoCommand<ScreenshotTakenMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: { command: 'screenshot-taken' },
            src,
        };
        void browser.tabs.sendMessage(tabId, command);
    }

    private _notifyRecordingFinished(src: string, tabId: number) {
        const command: ExtensionToVideoCommand<RecordingFinishedMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: { command: 'recording-finished' },
            src,
        };
        void browser.tabs.sendMessage(tabId, command).catch(() => {});
    }
}
