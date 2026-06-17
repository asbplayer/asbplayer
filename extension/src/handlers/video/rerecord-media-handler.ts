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
import MediaCache from '../../services/media-cache';

export default class RerecordMediaHandler {
    private readonly _settingsProvider: SettingsProvider;
    private readonly _audioRecorder: AudioRecorderService;
    private readonly _cardPublisher: CardPublisher;
    private readonly _mediaCache: MediaCache;

    constructor(
        settingsProvider: SettingsProvider,
        audioRecorder: AudioRecorderService,
        cardPublisher: CardPublisher,
        mediaCache: MediaCache
    ) {
        this._settingsProvider = settingsProvider;
        this._audioRecorder = audioRecorder;
        this._cardPublisher = cardPublisher;
        this._mediaCache = mediaCache;
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

        try {
            const audioBase64 = await this._audioRecorder.startWithTimeout(
                rerecordCommand.message.duration / rerecordCommand.message.playbackRate +
                    rerecordCommand.message.audioPaddingEnd,
                false,
                { src: rerecordCommand.src, tabId: sender.tab?.id! }
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

        const { uiState } = rerecordCommand.message;
        const cacheKey = this._mediaCache.key(sender.tab!.id!, rerecordCommand.src);
        this._mediaCache.set(cacheKey, {
            subtitleStart: uiState.subtitle.start,
            subtitleEnd: uiState.subtitle.end,
            audioModel: audio,
            imageModel: uiState.image,
        });

        this._cardPublisher.publish(
            {
                audio: audio,
                image: uiState.image,
                url: uiState.url,
                subtitle: uiState.subtitle,
                surroundingSubtitles: uiState.surroundingSubtitles,
                subtitleFileName: rerecordCommand.message.subtitleFileName,
                mediaTimestamp: rerecordCommand.message.timestamp,
            },
            undefined,
            sender.tab!.id!,
            rerecordCommand.src
        );

        const newUiState = {
            ...uiState,
            audio: audio,
            lastAppliedTimestampIntervalToAudio: uiState.timestampInterval,
        };

        const showAnkiUiAfterRerecordCommand: ExtensionToVideoCommand<ShowAnkiUiAfterRerecordMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'show-anki-ui-after-rerecord',
                uiState: newUiState,
            },
            src: rerecordCommand.src,
        };

        browser.tabs.sendMessage(sender.tab!.id!, showAnkiUiAfterRerecordCommand);
    }
}
