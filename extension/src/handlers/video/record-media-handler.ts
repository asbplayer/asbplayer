import { asbError } from '@project/common/util/log';
import type ImageCapturer from '@project/extension/src/services/image-capturer';
import type {
    AudioModel,
    Command,
    ImageModel,
    Message,
    RecordMediaAndForwardSubtitleMessage,
    VideoToExtensionCommand,
    ExtensionToVideoCommand,
    ScreenshotTakenMessage,
    CardModel,
} from '@project/common';
import { AudioErrorCode, ImageErrorCode, PostMineAction } from '@project/common';
import type { SettingsProvider } from '@project/common/settings';
import type { CardPublisher } from '@project/extension/src/services/card-publisher';
import type AudioRecorderService from '@project/extension/src/services/audio-recorder-service';
import type { RecordedMedia } from '@project/extension/src/services/audio-recorder-delegate';
import {
    DrmProtectedStreamError,
    RecordingInProgressError,
} from '@project/extension/src/services/audio-recorder-service';
import {
    animatedWebpAudioModel,
    negotiateAnimatedWebp,
    shouldUseAnimatedWebp,
} from '@project/extension/src/services/animated-webp-media';

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
        let audioPromise: Promise<RecordedMedia> | undefined;
        let imagePromise: Promise<string> | undefined;
        let imageModel: ImageModel | undefined = undefined;
        let audioModel: AudioModel | undefined = undefined;
        let encodeAsMp3 = false;

        const tabId = sender.tab?.id;
        if (tabId === undefined) throw new Error('Cannot record media without a valid tab ID');

        // Capture window (subtitle duration adjusted for playback rate + padding), shared by audio
        // recording and the animated-WebP capture.
        const windowMs = (subtitle.end - subtitle.start) / message.playbackRate + message.audioPaddingEnd;

        // An animated WebP captures the tab's video and audio together in a single stream, so it replaces
        // the separate audio recording instead of adding to it.
        const useAnimatedWebp = await shouldUseAnimatedWebp(this._settingsProvider, message);

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
            const { maxWidth, maxHeight, rect, frameId, trimBlackBars } = message;

            try {
                // When the content script already armed a capture before the seek (see binding.ts /
                // animated-webp-capture.ts), skip re-negotiating settings and a tabCapture stream - it
                // would just be discarded, and doing it again here is exactly the latency this avoids.
                const negotiation = message.animatedWebpArmed
                    ? undefined
                    : await negotiateAnimatedWebp(this._settingsProvider, tabId);
                const { base64, audioBase64 } = await this._audioRecorder.recordAnimatedWebpWithTimeout(
                    windowMs,
                    message.record,
                    { maxWidth, maxHeight, rect, frameId, trimBlackBars },
                    { src, tabId },
                    negotiation,
                    () => negotiateAnimatedWebp(this._settingsProvider, tabId)
                );
                imageModel = {
                    base64,
                    extension: 'webp',
                    error: base64 ? undefined : ImageErrorCode.captureFailed,
                };
                audioModel = await animatedWebpAudioModel(audioBase64, encodeAsMp3, message);
            } catch (e) {
                if (e instanceof RecordingInProgressError) {
                    throw e;
                }

                asbError('recording/animated-webp', e);
                imageModel = { base64: '', extension: 'webp', error: ImageErrorCode.captureFailed };
            } finally {
                // The audio recorder service signals the recording state, but the screenshot path normally
                // restores the subtitles/controls that were hidden for a clean capture.
                this._notifyScreenshotTaken(src, tabId);
            }
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
                trimBlackBars: recordMediaCommand.message.trimBlackBars,
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
                const { audioBase64 } = await audioPromise;
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
            void this._cardPublisher.publishBulk(card, tabId, recordMediaCommand.src);
        } else {
            void this._cardPublisher.publish(card, message.postMineAction, tabId, recordMediaCommand.src, noteId);
        }
    }

    private _notifyScreenshotTaken(src: string, tabId: number) {
        const command: ExtensionToVideoCommand<ScreenshotTakenMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: { command: 'screenshot-taken' },
            src,
        };
        void browser.tabs.sendMessage(tabId, command);
    }
}
