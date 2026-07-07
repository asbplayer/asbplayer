import {
    AudioErrorCode,
    AudioModel,
    Command,
    ExtensionToVideoCommand,
    Message,
    RerecordMediaMessage,
    ShowAnkiUiAfterRerecordMessage,
    VideoToExtensionCommand,
} from '@project/common';
import { CardPublisher } from '../../services/card-publisher';
import { SettingsProvider } from '@project/common/settings';
import AudioRecorderService, { DrmProtectedStreamError } from '../../services/audio-recorder-service';

export default class RerecordMediaHandler {
    private readonly _settingsProvider: SettingsProvider;
    private readonly _audioRecorder: AudioRecorderService;
    private readonly _cardPublisher: CardPublisher;

    constructor(settingsProvider: SettingsProvider, audioRecorder: AudioRecorderService, cardPublisher: CardPublisher) {
        this._settingsProvider = settingsProvider;
        this._audioRecorder = audioRecorder;
        this._cardPublisher = cardPublisher;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'rerecord-media';
    }

    async handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        const rerecordCommand = command as VideoToExtensionCommand<RerecordMediaMessage>;
        const baseAudioModel: AudioModel = {
            base64: '',
            extension: 'webm',
            paddingStart: rerecordCommand.message.audioPaddingStart,
            paddingEnd: rerecordCommand.message.audioPaddingEnd,
            start: rerecordCommand.message.timestamp,
            end:
                rerecordCommand.message.timestamp +
                rerecordCommand.message.duration / rerecordCommand.message.playbackRate,
            playbackRate: rerecordCommand.message.playbackRate,
        };
        let audio: AudioModel;

        const tabId = sender.tab?.id;
        if (tabId === undefined) throw new Error('Cannot rerecord media without a valid tab ID');

        try {
            const audioBase64 = await this._audioRecorder.startWithTimeout(
                rerecordCommand.message.duration / rerecordCommand.message.playbackRate +
                    rerecordCommand.message.audioPaddingEnd,
                false,
                { src: rerecordCommand.src, tabId }
            );
            audio = {
                ...baseAudioModel,
                base64: audioBase64,
            };
        } catch (e) {
            if (!(e instanceof DrmProtectedStreamError)) {
                throw e;
            }

            audio = {
                ...baseAudioModel,
                error: AudioErrorCode.drmProtected,
            };
        }

        void this._cardPublisher.publish(
            {
                audio: audio,
                image: rerecordCommand.message.uiState.image,
                url: rerecordCommand.message.uiState.url,
                subtitle: rerecordCommand.message.uiState.subtitle,
                surroundingSubtitles: rerecordCommand.message.uiState.surroundingSubtitles,
                subtitleFileName: rerecordCommand.message.subtitleFileName,
                mediaTimestamp: rerecordCommand.message.timestamp,
            },
            undefined,
            tabId,
            rerecordCommand.src
        );

        const newUiState = {
            ...rerecordCommand.message.uiState,
            audio: audio,
            lastAppliedTimestampIntervalToAudio: rerecordCommand.message.uiState.timestampInterval,
        };

        const showAnkiUiAfterRerecordCommand: ExtensionToVideoCommand<ShowAnkiUiAfterRerecordMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'show-anki-ui-after-rerecord',
                uiState: newUiState,
            },
            src: rerecordCommand.src,
        };

        void browser.tabs.sendMessage(tabId, showAnkiUiAfterRerecordCommand);
    }
}
