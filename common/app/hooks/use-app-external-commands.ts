import { asbError } from '@project/common/util/log';
import type { WebSocketClientSettings } from '@project/common/settings';
import type { CardTextFieldValues, PostMineAction } from '@project/common/src/model';
import type { ExternalCommandMessage } from '@project/common';
import { WebSocketClient, ExternalCommandDispatcher } from '@project/common/external-commands';
import type ChromeExtension from '@project/common/app/services/chrome-extension';
import type { ExtensionMessage } from '@project/common/app/services/chrome-extension';
import { useEffect, useState } from 'react';

export interface MineSubtitleParams extends CardTextFieldValues {
    postMineAction: PostMineAction;
}

// Extensions older than the forwarding release already handle the other commands for this app.
const legacyExtensionCommands = ['seek-timestamp', 'load-subtitles'] as const;

export const useAppExternalCommands = ({
    settings,
    extension,
    inVideoPlayer,
}: {
    settings: WebSocketClientSettings;
    extension: ChromeExtension;
    inVideoPlayer: boolean;
}) => {
    const [dispatcher] = useState(() => new ExternalCommandDispatcher());
    const forwardedByExtension = extension.supportsWebSocketClientOwnership;
    const legacyExtension = extension.supportsWebSocketClient && !forwardedByExtension;

    useEffect(() => {
        if (inVideoPlayer || forwardedByExtension || !settings.webSocketClientEnabled || !settings.webSocketServerUrl) {
            return;
        }

        const client = new WebSocketClient(dispatcher, {
            commands: legacyExtension ? legacyExtensionCommands : undefined,
        });
        client.bind(settings.webSocketServerUrl).catch((error) => asbError('web-socket', error));
        return () => client.unbind();
    }, [
        dispatcher,
        inVideoPlayer,
        forwardedByExtension,
        legacyExtension,
        settings.webSocketClientEnabled,
        settings.webSocketServerUrl,
    ]);

    useEffect(() => {
        if (inVideoPlayer || !forwardedByExtension) {
            return;
        }

        return extension.subscribe((message: ExtensionMessage) => {
            if (message.data.command !== 'external-command') {
                return;
            }

            const { messageId, externalCommand } = message.data as ExternalCommandMessage;
            void dispatcher
                .dispatchCommand(externalCommand)
                .catch((error) => {
                    asbError('external-command', error);
                    return undefined;
                })
                .then((response) => extension.sendExternalCommandResponse(messageId, response));
        });
    }, [dispatcher, extension, inVideoPlayer, forwardedByExtension]);

    return dispatcher;
};
