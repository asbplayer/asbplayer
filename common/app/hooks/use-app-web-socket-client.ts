import { asbError } from '@project/common/util';
import { WebSocketClientSettings } from '@project/common/settings';
import { CardTextFieldValues, PostMineAction } from '@project/common/src/model';
import { WebSocketClient } from '@project/common/web-socket-client';
import { useEffect, useState } from 'react';

export interface MineSubtitleParams extends CardTextFieldValues {
    postMineAction: PostMineAction;
}

export const useAppWebSocketClient = ({ settings }: { settings: WebSocketClientSettings }) => {
    const [client, setClient] = useState<WebSocketClient>();

    useEffect(() => {
        if (settings.webSocketClientEnabled && settings.webSocketServerUrl) {
            const client = new WebSocketClient();
            client.bind(settings.webSocketServerUrl).catch((error) => asbError(error, { asbLogLabel: 'web-socket' }));
            setClient(client);
            return () => client.unbind();
        }

        setClient(undefined);
    }, [settings.webSocketServerUrl, settings.webSocketClientEnabled]);

    return client;
};
