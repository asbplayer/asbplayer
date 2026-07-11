import ImageCapturer from '../../services/image-capturer';
import {
    AudioModel,
    Command,
    ImageErrorCode,
    ImageModel,
    Message,
    PostMineAction,
    StopRecordingMediaMessage,
    SubtitleModel,
    VideoToExtensionCommand,
} from '@project/common';
import { SettingsProvider } from '@project/common/settings';
import { mockSurroundingSubtitles } from '@project/common/util';
import { CardPublisher } from '../../services/card-publisher';
import AudioRecorderService, {
    TimedRecordingInProgressError,
    NoRecordingInProgressServiceError,
} from '../../services/audio-recorder-service';

export default class StopRecordingMediaHandler {
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
        return 'stop-recording-media';
    }

    async handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const stopRecordingCommand = command as VideoToExtensionCommand<StopRecordingMediaMessage>;
        const subtitle: SubtitleModel = stopRecordingCommand.message.subtitle ?? {
            text: '',
            start: stopRecordingCommand.message.startTimestamp,
            end: stopRecordingCommand.message.endTimestamp,
            originalStart: stopRecordingCommand.message.startTimestamp,
            originalEnd: stopRecordingCommand.message.startTimestamp,
            track: 0,
        };
        const surroundingSubtitles =
            stopRecordingCommand.message.surroundingSubtitles ??
            mockSurroundingSubtitles(subtitle, stopRecordingCommand.message.videoDuration, 5000);

        let imageModel: ImageModel | undefined = undefined;

        const tabId = sender.tab?.id;
        if (tabId === undefined) throw new Error('Cannot stop recording media without a valid tab ID');

        if (stopRecordingCommand.message.screenshot) {
            try {
                let lastImageBase64 = this._imageCapturer.lastImageBase64;

                if (lastImageBase64 === undefined) {
                    const { maxWidth, maxHeight, rect, frameId } = stopRecordingCommand.message;
                    lastImageBase64 = await this._imageCapturer.capture(tabId, stopRecordingCommand.src, 0, {
                        maxWidth,
                        maxHeight,
                        rect,
                        frameId,
                    });
                }

                imageModel = {
                    base64: lastImageBase64,
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

        try {
            let encodeAsMp3 = false;

            if (stopRecordingCommand.message.postMineAction !== PostMineAction.showAnkiDialog) {
                encodeAsMp3 = await this._settingsProvider.getSingle('preferMp3');
            }

            const audioBase64 = await this._audioRecorder.stop(encodeAsMp3, {
                tabId,
                src: stopRecordingCommand.src,
            });
            const audioModel: AudioModel = {
                base64: audioBase64,
                extension: encodeAsMp3 ? 'mp3' : 'webm',
                paddingStart: 0,
                paddingEnd: 0,
                start: stopRecordingCommand.message.startTimestamp,
                end: stopRecordingCommand.message.endTimestamp,
                playbackRate: stopRecordingCommand.message.playbackRate,
            };

            void this._cardPublisher.publish(
                {
                    subtitle: subtitle,
                    surroundingSubtitles: surroundingSubtitles,
                    image: imageModel,
                    audio: audioModel,
                    url: stopRecordingCommand.message.url,
                    subtitleFileName: stopRecordingCommand.message.subtitleFileName,
                    mediaTimestamp: stopRecordingCommand.message.startTimestamp,
                },
                stopRecordingCommand.message.postMineAction,
                tabId,
                stopRecordingCommand.src
            );
        } catch (e) {
            // Ignore benign stop conditions where recording is already finished or not in progress
            if (e instanceof TimedRecordingInProgressError) {
                // A recording scheduled from record-media-handler (or rerecord-media-handler) was in-progress
                // and the call to stop() just above force-stopped it.
                // We should do nothing else because execution in record-media-handler will continue
                // and publish the card etc.
                return;
            } else if (e instanceof NoRecordingInProgressServiceError) {
                return;
            }

            throw e;
        }
    }
}
