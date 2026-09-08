import { asbError } from '@project/common/util';
import { isFirefoxBuild } from '@/services/build-flags';
import { ensureOffscreenAudioServiceDocument } from '@/services/offscreen-document';
import type {
    Command,
    EncodeMp3InServiceWorkerMessage,
    ExtensionToOffscreenDocumentCommand,
    Message,
    VideoToExtensionCommand,
} from '@project/common';
import Mp3Encoder from '@project/common/audio-clip/mp3-encoder';
import { base64ToBlob, bufferToBase64 } from '@project/common/base64';

export default class EncodeMp3Handler {
    constructor() {}

    get sender() {
        return ['asbplayer-video', 'asbplayer-video-tab'];
    }

    get command() {
        return 'encode-mp3';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const tabId = sender.tab?.id;

        if (tabId === undefined) {
            return;
        }

        const {
            message: { base64, extension },
        } = command as VideoToExtensionCommand<EncodeMp3InServiceWorkerMessage>;

        if (isFirefoxBuild) {
            Mp3Encoder.encode(base64ToBlob(base64, `audio/${extension}`), () => new Worker('mp3-encoder-worker.js'))
                .then((blob) => blob.arrayBuffer())
                .then((buffer) => sendResponse(bufferToBase64(buffer)))
                .catch((error) => asbError('recording/encoding', error));
        } else {
            ensureOffscreenAudioServiceDocument()
                .then(() => {
                    const audioServiceCommand: ExtensionToOffscreenDocumentCommand<EncodeMp3InServiceWorkerMessage> = {
                        sender: 'asbplayer-extension-to-offscreen-document',
                        message: {
                            command: 'encode-mp3',
                            base64,
                            extension,
                        },
                    };
                    return browser.runtime.sendMessage(audioServiceCommand);
                })
                .then(sendResponse)
                .catch((error) => asbError('recording/encoding', error));
        }

        return true;
    }
}
