import type { SettingsProvider } from '@project/common/settings';
import { WebSocketClient } from '@project/common/web-socket-client';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import { webSocketCommandHandlers } from '@project/extension/src/services/web-socket-command-handlers';

let client: WebSocketClient | undefined;

export const bindWebSocketClient = async (settings: SettingsProvider, tabRegistry: TabRegistry) => {
    client?.unbind();
    const url = await settings.getSingle('webSocketServerUrl');

    if (!url) {
        return;
    }

    client = new WebSocketClient();
    void client.bind(url);
    client.setHandlers(webSocketCommandHandlers(settings, tabRegistry));
};

export const unbindWebSocketClient = () => {
    client?.unbind();
};
