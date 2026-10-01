import { asbError } from '@project/common/util/log';
import type { WebSocketClientSettings } from '@project/common/settings';
import type { CardTextFieldValues, PostMineAction } from '@project/common/src/model';
import { WebSocketClient } from '@project/common/web-socket-client';
import { useEffect, useState } from 'react';

export interface MineSubtitleParams extends CardTextFieldValues {
    postMineAction: PostMineAction;
}

export const useAppWebSocketClient = ({
    settings,
    appOwnsConnection,
}: {
    settings: WebSocketClientSettings;
    appOwnsConnection: boolean;
}) => {
    const [client, setClient] = useState<WebSocketClient>();

    useEffect(() => {
        if (appOwnsConnection && settings.webSocketClientEnabled && settings.webSocketServerUrl) {
            const client = new WebSocketClient();
            client.bind(settings.webSocketServerUrl).catch((error) => asbError('web-socket', error));
            setClient(client);
            return () => client.unbind();
        }

        setClient(undefined);
    }, [settings.webSocketServerUrl, settings.webSocketClientEnabled, appOwnsConnection]);

    return client;
};
