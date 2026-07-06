import { HttpPostMessage } from '@project/common';
import Bridge from './bridge';
import { v4 as uuidv4 } from 'uuid';

export class BridgeFetcher {
    private readonly _bridge: Bridge;
    constructor(bridge: Bridge) {
        this._bridge = bridge;
    }

    async fetch(url: string, body: any) {
        const httpPostMessage: HttpPostMessage = {
            command: 'http-post',
            url,
            body,
            messageId: uuidv4(),
        };
        return this._bridge.sendMessageFromServerAndExpectResponse(httpPostMessage);
    }
}
