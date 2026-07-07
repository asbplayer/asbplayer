import ImageCapturer from '../../services/image-capturer';
import {
    AudioErrorCode,
    AudioModel,
    Command,
    ExtensionToVideoCommand,
    ImageErrorCode,
    ImageModel,
    Message,
    PostMineAction,
    ScreenshotTakenMessage,
    StartRecordingMediaMessage,
    SubtitleModel,
    VideoToExtensionCommand,
} from '@project/common';
import { CardPublisher } from '../../services/card-publisher';
import AudioRecorderService, { DrmProtectedStreamError } from '../../services/audio-recorder-service';
import { SettingsProvider } from '@project/common/settings';

export default class StartRecordingMediaHandler {
    private readonly _audioRecorder: AudioRecorderService;
    private readonly _imageCapturer: ImageCapturer;
    private readonly _cardPublisher: CardPublisher;
    private readonly _settings: SettingsProvider;

    constructor(
        audioRecorder: AudioRecorderService,
        imageCapturer: ImageCapturer,
        cardPublisher: CardPublisher,
        settings: SettingsProvider
    ) {
        this._audioRecorder = audioRecorder;
        this._imageCapturer = imageCapturer;
        this._cardPublisher = cardPublisher;
        this._settings = settings;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'start-recording-media';
    }

    async handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const startRecordingCommand = command as VideoToExtensionCommand<StartRecordingMediaMessage>;
        let drmProtectedStreamError: DrmProtectedStreamError | undefined;

        const tabId = sender.tab?.id;
        if (tabId === undefined) throw new Error('Cannot start recording media without a valid tab ID');

        if (startRecordingCommand.message.record) {
            try {
                await this._audioRecorder.start({ src: startRecordingCommand.src, tabId });
            } catch (e) {
                if (!(e instanceof DrmProtectedStreamError)) {
                    throw e;
                }

                drmProtectedStreamError = e;
            }
        }

        let imageModel: ImageModel | undefined;

        if (startRecordingCommand.message.screenshot) {
            const imageDelay = startRecordingCommand.message.record ? startRecordingCommand.message.imageDelay : 0;
            const { maxWidth, maxHeight, rect, frameId } = startRecordingCommand.message;
            try {
                const imageBase64 = await this._imageCapturer.capture(tabId, startRecordingCommand.src, imageDelay, {
                    maxWidth,
                    maxHeight,
                    rect,
                    frameId,
                });
                imageModel = {
                    base64: imageBase64,
                    extension: 'jpeg',
                };
            } catch (e) {
                console.error(e);
                imageModel = {
                    base64: '',
                    extension: 'jpeg',
                    error: ImageErrorCode.captureFailed,
                };
            } finally {
                const screenshotTakenCommand: ExtensionToVideoCommand<ScreenshotTakenMessage> = {
                    sender: 'asbplayer-extension-to-video',
                    message: {
                        command: 'screenshot-taken',
                    },
                    src: startRecordingCommand.src,
                };

                void browser.tabs.sendMessage(tabId, screenshotTakenCommand);
            }
        }

        if (!startRecordingCommand.message.record || drmProtectedStreamError !== undefined) {
            const mediaTimestamp = startRecordingCommand.message.mediaTimestamp;

            const subtitle: SubtitleModel = {
                text: '',
                start: mediaTimestamp,
                originalStart: mediaTimestamp,
                end: mediaTimestamp,
                originalEnd: mediaTimestamp,
                track: 0,
            };

            let encodeAsMp3 = false;

            if (startRecordingCommand.message.postMineAction !== PostMineAction.showAnkiDialog) {
                encodeAsMp3 = await this._settings.getSingle('preferMp3');
            }

            const audioModel: AudioModel | undefined =
                drmProtectedStreamError === undefined
                    ? undefined
                    : {
                          base64: '',
                          extension: encodeAsMp3 ? 'mp3' : 'webm',
                          paddingStart: 0,
                          paddingEnd: 0,
                          start: mediaTimestamp,
                          end: mediaTimestamp,
                          playbackRate: 1,
                          error: AudioErrorCode.drmProtected,
                      };

            void this._cardPublisher.publish(
                {
                    subtitle: subtitle,
                    surroundingSubtitles: [],
                    image: imageModel,
                    audio: audioModel,
                    url: startRecordingCommand.message.url,
                    subtitleFileName: startRecordingCommand.message.subtitleFileName,
                    mediaTimestamp: startRecordingCommand.message.mediaTimestamp,
                },
                startRecordingCommand.message.postMineAction,
                tabId,
                startRecordingCommand.src
            );
        }
    }
}
