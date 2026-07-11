import { AudioBase64Message, Command, Message } from '@project/common';
import AudioRecorderService from '../../services/audio-recorder-service';

export default class AudioBase64Handler {
    private readonly _audioRecorder: AudioRecorderService;

    constructor(offscreenAudioRecorder: AudioRecorderService) {
        this._audioRecorder = offscreenAudioRecorder;
    }

    get sender() {
        return ['asbplayer-offscreen-document', 'asbplayer-video'];
    }

    get command() {
        return 'audio-base64';
    }

    handle(command: Command<Message>) {
        const audioBase64Command = command as Command<AudioBase64Message>;
        this._audioRecorder.onAudioBase64(audioBase64Command.message.base64, audioBase64Command.message.requestId);
        return false;
    }
}
