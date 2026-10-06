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
import { DrmProtectedStreamError } from '@project/extension/src/services/audio-recorder-service';
import type { ImageRecordingRequest, RecordedMedia } from '@project/extension/src/services/audio-recorder-delegate';
import { shouldUseAnimatedWebp } from '@project/extension/src/services/animated-webp-media';

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
        let mediaPromise: Promise<RecordedMedia> | undefined = undefined;
        let imagePromise = undefined;
        let imageModel: ImageModel | undefined = undefined;
        let audioModel: AudioModel | undefined = undefined;
        let encodeAsMp3 = false;

        const tabId = sender.tab?.id;
        if (tabId === undefined) throw new Error('Cannot record media without a valid tab ID');

        // An animated WebP is recorded together with the audio, so it's requested from the recorder and takes
        // the place of the screenshot.
        const { maxWidth, maxHeight, rect, frameId, trimBlackBars } = message;
        const image: ImageRecordingRequest | undefined = (await shouldUseAnimatedWebp(this._settingsProvider, message))
            ? {
                  captureParams: { maxWidth, maxHeight, rect, frameId, trimBlackBars },
                  armed: Boolean(message.animatedWebpArmed),
              }
            : undefined;

        if (message.record) {
            const time = (subtitle.end - subtitle.start) / message.playbackRate + message.audioPaddingEnd;

            if (message.postMineAction !== PostMineAction.showAnkiDialog) {
                encodeAsMp3 = await this._settingsProvider.getSingle('preferMp3');
            }

            mediaPromise = this._audioRecorder.startWithTimeout(
                time,
                encodeAsMp3,
                {
                    src: recordMediaCommand.src,
                    tabId,
                },
                image
            );
        }

        if (message.screenshot && image === undefined) {
            const screenshotDelay = Math.max(
                0,
                message.record
                    ? message.mediaTimestamp - subtitle.start + message.audioPaddingStart
                    : message.imageDelay
            );
            imagePromise = this._imageCapturer.capture(tabId, recordMediaCommand.src, screenshotDelay, {
                maxWidth,
                maxHeight,
                rect,
                frameId,
                trimBlackBars: recordMediaCommand.message.trimBlackBars,
            });
            void imagePromise.finally(() => this._notifyScreenshotTaken(recordMediaCommand.src, tabId));
        }

        if (mediaPromise) {
            const { audioPaddingStart: paddingStart, audioPaddingEnd: paddingEnd, playbackRate } = message;
            const baseAudioModel: AudioModel = {
                base64: '',
                extension: encodeAsMp3 ? 'mp3' : 'webm',
                paddingStart,
                paddingEnd,
                playbackRate,
            };

            try {
                const media = await mediaPromise;
                audioModel = {
                    ...baseAudioModel,
                    base64: media.audioBase64,
                };

                if (media.image) {
                    imageModel = {
                        ...media.image,
                        error: media.image.base64 ? undefined : ImageErrorCode.captureFailed,
                    };
                }
            } catch (e) {
                if (!(e instanceof DrmProtectedStreamError)) {
                    throw e;
                }

                audioModel = {
                    ...baseAudioModel,
                    error: AudioErrorCode.drmProtected,
                };
            } finally {
                if (image) {
                    // Restore the subtitles/controls that were hidden for a clean capture
                    this._notifyScreenshotTaken(recordMediaCommand.src, tabId);
                }
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
