import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Command, WriteClipboardMessage } from '@project/common';
import project from '@project/common/project';
import CopyToClipboardHandler from '@/handlers/video/copy-to-clipboard-handler';

const appOrigin = new URL(project.urls.app).origin;
const streamingOrigin = 'https://video.example';
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const browserDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'browser');
const clipboard: string[] = [];
const writeText = jest.fn<(text: string) => Promise<void>>();
const sendToTab =
    jest.fn<
        (tabId: number, message: Command<WriteClipboardMessage>, options: { frameId: number }) => Promise<boolean>
    >();

function request(
    handler: CopyToClipboardHandler,
    sender: string,
    metadata: Browser.runtime.MessageSender,
    data: unknown
): Promise<boolean> {
    const command = { sender, message: { command: 'clipboard-write', data } } as Command<WriteClipboardMessage>;
    return new Promise((resolve) => handler.handle(command, metadata, resolve));
}

function sender(origin: string, topLevelOrigin = origin, frameId = 0): Browser.runtime.MessageSender {
    return {
        id: 'asbplayer-id',
        origin,
        frameId,
        tab: { id: 21, url: `${topLevelOrigin}/player` } as Browser.tabs.Tab,
    };
}

beforeEach(() => {
    clipboard.length = 0;
    writeText.mockReset().mockImplementation(async (text) => void clipboard.push(text));
    sendToTab.mockReset().mockResolvedValue(true);
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
    });
    Object.defineProperty(globalThis, 'browser', {
        configurable: true,
        value: {
            runtime: {
                id: 'asbplayer-id',
                getURL: (path = '') => `chrome-extension://asbplayer-id/${path}`,
            },
            tabs: { sendMessage: sendToTab },
        },
    });
});

afterEach(() => {
    if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    else Reflect.deleteProperty(navigator, 'clipboard');
    if (browserDescriptor) Object.defineProperty(globalThis, 'browser', browserDescriptor);
    else Reflect.deleteProperty(globalThis, 'browser');
});

describe('background clipboard writes', () => {
    it('writes text from the official app and from an isolated video content script without relaying to a tab', async () => {
        const handler = new CopyToClipboardHandler({ allowDevOrigin: false });
        await expect(request(handler, 'asbplayerv2', sender(appOrigin), '字幕\nSecond line')).resolves.toBe(true);
        await expect(request(handler, 'asbplayer-clipboard-content-script', sender(streamingOrigin), '')).resolves.toBe(
            true
        );
        expect(clipboard).toEqual(['字幕\nSecond line', '']);
        expect(sendToTab).not.toHaveBeenCalled();
    });

    it.each([
        ['a lookalike origin', sender(`${appOrigin}.example`)],
        ['the insecure app URL', sender(`http://${new URL(appOrigin).host}`)],
        ['a non-default port', sender(`${appOrigin}:8080`)],
        ['the app framed by another site', sender(appOrigin, streamingOrigin)],
        ['a same-origin subframe of the app', sender(appOrigin, appOrigin, 1)],
        ['a sandboxed frame', sender('null', appOrigin)],
        ['a different extension', { ...sender(appOrigin), id: 'other-extension' }],
        ['a missing tab', { id: 'asbplayer-id', origin: appOrigin }],
    ])('rejects web clipboard requests from %s', async (_label, metadata) => {
        await expect(
            request(new CopyToClipboardHandler({ allowDevOrigin: false }), 'asbplayerv2', metadata, 'text')
        ).resolves.toBe(false);
        expect(clipboard).toEqual([]);
        expect(sendToTab).not.toHaveBeenCalled();
    });

    it('permits only the configured development origin and rejects oversized text', async () => {
        const dev = sender(`http://${project.development.host}:${project.development.port}`);
        const development = new CopyToClipboardHandler({ allowDevOrigin: true });
        const production = new CopyToClipboardHandler({ allowDevOrigin: false });
        const limit = 'a'.repeat(64 * 1024);
        await expect(request(production, 'asbplayerv2', dev, 'dev text')).resolves.toBe(false);
        await expect(request(development, 'asbplayerv2', dev, limit + 'a')).resolves.toBe(false);
        await expect(request(development, 'asbplayerv2', dev, limit)).resolves.toBe(true);
        expect(clipboard).toEqual([limit]);
    });

    it('tries the background write before relaying to the foreground on failure', async () => {
        const handler = new CopyToClipboardHandler({ allowDevOrigin: false });
        writeText.mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));
        await expect(
            request(handler, 'asbplayer-clipboard-content-script', sender(streamingOrigin), 'cue')
        ).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith('cue');
        expect(sendToTab).toHaveBeenCalledWith(
            21,
            { sender: 'asbplayer-background-clipboard', message: { command: 'clipboard-write', data: 'cue' } },
            { frameId: 0 }
        );
        expect(clipboard).toEqual([]);
        await expect(request(handler, 'asbplayerv2', sender(appOrigin), 'cue')).resolves.toBe(false);
        expect(sendToTab).toHaveBeenCalledTimes(1);
    });

    it('allows privileged extension pages without a tab and rejects other extension origins', async () => {
        const handler = new CopyToClipboardHandler({ allowDevOrigin: false });
        const sidePanel: Browser.runtime.MessageSender = {
            id: 'asbplayer-id',
            origin: 'chrome-extension://asbplayer-id',
            url: 'chrome-extension://asbplayer-id/sidepanel.html',
        };
        const popup: Browser.runtime.MessageSender = {
            id: 'asbplayer-id',
            url: 'chrome-extension://asbplayer-id/popup-ui.html',
        };
        const otherExtension: Browser.runtime.MessageSender = {
            id: 'asbplayer-id',
            origin: 'chrome-extension://other-extension',
        };

        await expect(request(handler, 'asbplayerv2', sidePanel, 'from side panel')).resolves.toBe(true);
        await expect(request(handler, 'asbplayer-clipboard-content-script', popup, 'from popup')).resolves.toBe(true);
        await expect(request(handler, 'asbplayerv2', otherExtension, 'blocked')).resolves.toBe(false);
        expect(clipboard).toEqual(['from side panel', 'from popup']);
        expect(sendToTab).not.toHaveBeenCalled();

        writeText.mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));
        await expect(request(handler, 'asbplayer-clipboard-content-script', popup, 'fails')).resolves.toBe(false);
        expect(sendToTab).not.toHaveBeenCalled();
    });

    it('rejects non-string payloads before attempting a write', async () => {
        const handler = new CopyToClipboardHandler({ allowDevOrigin: false });
        for (const payload of [
            { dataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
            { dataUrl: 'https://video.example/screenshot.png' },
            null,
            123,
        ]) {
            await expect(request(handler, 'asbplayerv2', sender(appOrigin), payload)).resolves.toBe(false);
            await expect(
                request(handler, 'asbplayer-clipboard-content-script', sender(streamingOrigin), payload)
            ).resolves.toBe(false);
        }
        expect(clipboard).toEqual([]);
        expect(sendToTab).not.toHaveBeenCalled();
    });
});
