import { v4 as uuidv4 } from 'uuid';

export class FrameInfoBroadcaster {
    readonly frameId = uuidv4();
    private _broadcastInterval?: ReturnType<typeof setInterval>;
    private _bound = false;

    bind() {
        if (this._bound) {
            return;
        }

        this._broadcastInterval = setInterval(() => this._broadcast(), 10000);
        this._broadcast();
        this._bound = true;
    }

    private _broadcast() {
        window.parent.postMessage(
            {
                sender: 'asbplayer-video',
                message: {
                    frameId: this.frameId,
                },
            },
            '*'
        );
    }

    unbind() {
        if (this._broadcastInterval !== undefined) {
            clearInterval(this._broadcastInterval);
            this._broadcastInterval = undefined;
        }

        this._bound = false;
    }
}

export class FrameInfoListener {
    readonly iframesById: { [key: string]: HTMLIFrameElement } = {};
    private _listener?: (event: MessageEvent) => void;
    private _bound = false;

    bind() {
        if (this._bound) {
            return;
        }

        this._listener = (event: MessageEvent) => {
            if (event.data?.sender !== 'asbplayer-video') {
                return;
            }

            const sourceIframe = this._sourceIframeForEvent(event);

            if (sourceIframe === undefined) {
                return;
            }

            const frameId = event.data.message.frameId;

            if (!frameId) {
                return;
            }

            this.iframesById[frameId] = sourceIframe;
        };

        window.addEventListener('message', this._listener);
        this._bound = true;
    }

    unbind() {
        if (this._listener !== undefined) {
            window.removeEventListener('message', this._listener);
            this._listener = undefined;
        }

        this._bound = false;
    }

    private _sourceIframeForEvent(event: MessageEvent) {
        const iframes = document.getElementsByTagName('iframe');
        for (const iframe of iframes) {
            if (iframe.contentWindow === event.source) {
                return iframe;
            }
        }

        return undefined;
    }
}
