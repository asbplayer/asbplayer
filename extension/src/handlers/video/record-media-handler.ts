import ImageCapturer from '../../services/image-capturer';
import {
    AudioModel,
    Command,
    ImageModel,
    Message,
    RecordMediaAndForwardSubtitleMessage,
    VideoToExtensionCommand,
    ExtensionToVideoCommand,
    ScreenshotTakenMessage,
    CardModel,
    AudioErrorCode,
    ImageErrorCode,
    PostMineAction,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { CardPublisher } from '../../services/card-publisher';
import AudioRecorderService, { DrmProtectedStreamError } from '../../services/audio-recorder-service';

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
        const senderTab = sender.tab!;
        const recordMediaCommand = command as VideoToExtensionCommand<RecordMediaAndForwardSubtitleMessage>;
        await this._recordAndForward(recordMediaCommand, sender, senderTab);
    }

    private async _recordAndForward(
        recordMediaCommand: VideoToExtensionCommand<RecordMediaAndForwardSubtitleMessage>,
        sender: Browser.runtime.MessageSender,
        senderTab: Browser.tabs.Tab
    ) {
        const message = recordMediaCommand.message;
        const subtitle = message.subtitle;
        let audioPromise = undefined;
        let imagePromise = undefined;
        let imageModel: ImageModel | undefined = undefined;
        let audioModel: AudioModel | undefined = undefined;
        let encodeAsMp3 = false;

        if (message.record) {
            const time = (subtitle.end - subtitle.start) / message.playbackRate + message.audioPaddingEnd;

            if (message.postMineAction !== PostMineAction.showAnkiDialog) {
                encodeAsMp3 = await this._settingsProvider.getSingle('preferMp3');
            }

            audioPromise = this._audioRecorder.startWithTimeout(time, encodeAsMp3, {
                src: recordMediaCommand.src,
                tabId: sender.tab?.id!,
            });
        }

        if (message.screenshot) {
            const { maxWidth, maxHeight, rect, frameId } = message;
            const screenshotDelay = Math.max(
                0,
                message.record
                    ? message.mediaTimestamp - subtitle.start + message.audioPaddingStart
                    : message.imageDelay
            );
            imagePromise = this._imageCapturer.capture(senderTab.id!, recordMediaCommand.src, screenshotDelay, {
                maxWidth,
                maxHeight,
                rect,
                frameId,
            });
            imagePromise.finally(() => {
                const screenshotTakenCommand: ExtensionToVideoCommand<ScreenshotTakenMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'screenshot-taken',
                    },
                    src: recordMediaCommand.src,
                };
                browser.tabs.sendMessage(senderTab.id!, screenshotTakenCommand);
            });
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

                // Use the last screenshot taken to allow user to re-take screenshot while audio is recording
                imageModel = {
                    base64: this._imageCapturer.lastImageBase64!,
                    extension: 'jpeg',
                };
            } catch (e) {
                console.error(e);
                imageModel = {
                    base64: '',
                    extension: 'jpeg',
                    error: ImageErrorCode.captureFailed,
                };
            }
        }

        const { isBulkExport, ...messageWithoutBulkFlag } = message;
        const card: CardModel = {
            image: imageModel,
            audio: audioModel,
            ...messageWithoutBulkFlag,
        };

        if (isBulkExport) {
            this._cardPublisher.publishBulk(card, senderTab.id!, recordMediaCommand.src);
        } else {
            this._cardPublisher.publish(card, message.postMineAction, senderTab.id!, recordMediaCommand.src);
        }
    }
}
