import { asbError } from '@project/common/util/log';
import type {
    ArmAnimatedWebpCaptureMessage,
    ArmAnimatedWebpCaptureResponse,
    Command,
    ExtensionToOffscreenDocumentCommand,
    Message,
    PrepareAnimatedWebpRecordingMessage,
    VideoToExtensionCommand,
} from '@project/common';
import type { SettingsProvider } from '@project/common/settings';
import { negotiateAnimatedWebp } from '@project/extension/src/services/animated-webp-media';
import { ensureOffscreenAudioServiceDocument } from '@project/extension/src/services/offscreen-document';
import { resolveCaptureArea } from '@project/extension/src/services/video-capturer';

// Opens the tab-capture stream in the offscreen document ahead of the mining seek, so the recording doesn't have to
// do it afterward - see armAnimatedWebpCapture for why that ordering matters.
export default class PrepareAnimatedWebpRecordingHandler {
    private readonly _settingsProvider: SettingsProvider;

    constructor(settingsProvider: SettingsProvider) {
        this._settingsProvider = settingsProvider;
    }

    get sender() {
        return 'asbplayer-video';
    }

    get command() {
        return 'prepare-animated-webp-recording';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender, sendResponse: (response?: any) => void) {
        const tabId = sender.tab?.id;

        if (tabId === undefined) {
            sendResponse({ armed: false, error: 'Cannot prepare animated WebP recording without a valid tab ID' });
            return true;
        }

        const { message, src } = command as VideoToExtensionCommand<PrepareAnimatedWebpRecordingMessage>;
        void this._arm(tabId, src, message)
            .then(sendResponse)
            .catch((e) => {
                asbError('recording/prepare-animated-webp', e);
                sendResponse({ armed: false, error: String(e?.message ?? e) });
            });

        return true;
    }

    private async _arm(
        tabId: number,
        src: string,
        { rect, frameId }: PrepareAnimatedWebpRecordingMessage
    ): Promise<ArmAnimatedWebpCaptureResponse> {
        const [{ streamId, fps, quality }, { viewport }] = await Promise.all([
            negotiateAnimatedWebp(this._settingsProvider, tabId),
            resolveCaptureArea(tabId, src, rect, frameId),
            ensureOffscreenAudioServiceDocument(),
        ]);
        const command: ExtensionToOffscreenDocumentCommand<ArmAnimatedWebpCaptureMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: { command: 'arm-animated-webp-capture', streamId, fps, quality, viewport },
        };
        return browser.runtime.sendMessage(command);
    }
}
