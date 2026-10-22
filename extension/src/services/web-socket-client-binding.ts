import { asbError } from '@project/common/util/log';
import type { SettingsProvider } from '@project/common/settings';
import { WebSocketClient } from '@project/common/external-commands';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import { externalCommandHandlers } from '@project/extension/src/services/external-command-handlers';

let client: WebSocketClient | undefined;
let clientUrl: string | undefined;

export const bindWebSocketClient = async (settings: SettingsProvider, tabRegistry: TabRegistry) => {
    const url = await settings.getSingle('webSocketServerUrl');

    // Everything below is synchronous so that concurrent calls can't each create a client and orphan the others
    if (client !== undefined && clientUrl === url) {
        client.setHandlers(externalCommandHandlers(settings, tabRegistry));
        return;
    }

    client?.unbind();
    client = undefined;
    clientUrl = undefined;

    if (!url) {
        return;
    }

    const newClient = new WebSocketClient();
    client = newClient;
    clientUrl = url;
    void newClient.bind(url).catch((error) => {
        asbError('web-socket', 'Failed to connect to the WebSocket server:', error);
    });
    newClient.setHandlers(externalCommandHandlers(settings, tabRegistry));
};

export const unbindWebSocketClient = () => {
    client?.unbind();
    client = undefined;
    clientUrl = undefined;
};
