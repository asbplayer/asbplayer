import { afterEach, beforeEach, describe, expect, jest } from '@jest/globals';
import type { VideoTabModel } from '@project/common';
import type { ExternalConnectionsState } from '@project/common/global-state';
import type { SettingsProvider } from '@project/common/settings';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import { ExternalConnectionCoordinator } from '@project/extension/src/services/external-connection-coordinator';
import { ExtensionBadgeController } from '@project/extension/src/services/extension-badge-controller';
import { ExtensionGlobalStateProvider } from '@project/extension/src/services/extension-global-state-provider';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';

const flush = async () => {
    for (let i = 0; i < 20; i++) {
        await Promise.resolve();
    }
};

class FakePort {
    readonly sender = { id: undefined as string | undefined };
    disconnected = false;
    readonly posted: unknown[] = [];
    private readonly _messageListeners: ((message: unknown) => void)[] = [];
    private readonly _disconnectListeners: (() => void)[] = [];

    readonly postMessage = jest.fn((message: unknown) => {
        if (this.disconnected) {
            throw new Error('Disconnected port');
        }

        this.posted.push(message);
    });

    readonly onMessage = {
        addListener: (listener: (message: unknown) => void) => {
            this._messageListeners.push(listener);
        },
    };

    readonly onDisconnect = {
        addListener: (listener: () => void) => {
            this._disconnectListeners.push(listener);
        },
    };

    constructor(id?: string) {
        this.sender.id = id;
    }

    async receive(message: unknown) {
        for (const listener of [...this._messageListeners]) {
            listener(message);
        }

        await flush();
    }

    disconnect() {
        this.disconnected = true;

        for (const listener of [...this._disconnectListeners]) {
            listener();
        }
    }

    approvalFrames() {
        return this.posted.filter((message) => (message as any).type === 'asbplayer-external-approval');
    }

    responses() {
        return this.posted.filter((message) => (message as any).command === 'response');
    }
}

class Harness {
    readonly storage = new MockStorageArea();
    readonly globalStateProvider = new ExtensionGlobalStateProvider(this.storage);
    readonly badgeAction = { setBadgeText: jest.fn() };
    readonly badgeController = new ExtensionBadgeController(this.badgeAction);
    readonly dispatcher: any = {
        setHandlers: jest.fn(),
        dispatchCommand: jest.fn(),
    };
    videoElements: VideoTabModel[] = [
        { id: 1, src: 'src1', subscribed: true, synced: false, loadedSubtitles: false },
        { id: 2, src: 'src2', subscribed: true, synced: false, loadedSubtitles: false },
    ];
    coordinator: ExternalConnectionCoordinator;

    private readonly _connectListeners: ((port: Browser.runtime.Port) => void)[] = [];

    constructor() {
        (globalThis as any).browser = {
            runtime: {
                onConnectExternal: {
                    addListener: (listener: (port: Browser.runtime.Port) => void) =>
                        this._connectListeners.push(listener),
                },
            },
            storage: {
                local: this.storage,
            },
        };
        this.coordinator = new ExternalConnectionCoordinator({
            globalStateProvider: this.globalStateProvider,
            tabRegistry: { activeVideoElements: async () => this.videoElements } as unknown as TabRegistry,
            settings: {} as unknown as SettingsProvider,
            badgeController: this.badgeController,
            dispatcher: this.dispatcher,
        });
    }

    connect(id?: string): FakePort {
        const port = new FakePort(id);

        for (const listener of [...this._connectListeners]) {
            listener(port as unknown as Browser.runtime.Port);
        }

        return port;
    }

    async externalConnectionsChanged(newValue: ExternalConnectionsState) {
        await this.globalStateProvider.set({ externalConnections: newValue });
    }

    async approve(id: string, name?: string) {
        await this.globalStateProvider.set({ externalConnections: this.approvedState(id, name) });
    }

    async seedPending(pending: ExternalConnectionsState['pending']) {
        await this.globalStateProvider.set({ externalConnections: { approved: {}, pending } });
    }

    async pendingEntries(): Promise<ExternalConnectionsState['pending']> {
        return (await this.globalStateProvider.get(['externalConnections'])).externalConnections.pending;
    }

    async approvedEntries(): Promise<ExternalConnectionsState['approved']> {
        return (await this.globalStateProvider.get(['externalConnections'])).externalConnections.approved;
    }

    emptyState(): ExternalConnectionsState {
        return { approved: {}, pending: {} };
    }

    pendingState(): ExternalConnectionsState {
        return {
            approved: {},
            pending: { sibling: { name: 'Sibling', requestedAt: Date.now() } },
        };
    }

    approvedState(id: string, name?: string): ExternalConnectionsState {
        return {
            approved: { [id]: { name, approvedAt: Date.now() } },
            pending: {},
        };
    }

    lastGlobalBadgeText() {
        const calls = this.badgeAction.setBadgeText.mock.calls as any[][];
        const globalCalls = calls.filter(([details]) => details.tabId === undefined);
        return globalCalls[globalCalls.length - 1]?.[0].text;
    }

    teardown() {
        delete (globalThis as any).browser;
        jest.restoreAllMocks();
    }
}

describe('external connection coordinator', () => {
    let harness: Harness;

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        harness = new Harness();
    });

    afterEach(() => {
        harness?.teardown();
    });

    it('greets an unapproved connection with an unapproved approval frame and drops its commands', async () => {
        const port = harness.connect('sibling');
        await flush();

        expect(approvalFrames(port)).toEqual([{ type: 'asbplayer-external-approval', approved: false }]);

        await port.receive({ command: 'get-bound-media', messageId: 'm1', body: {} });

        expect(harness.dispatcher.dispatchCommand).not.toHaveBeenCalled();
        expect(port.responses()).toEqual([]);
        // Not even a pending request, because the external extension never identified itself.
        expect(Object.keys(await harness.pendingEntries())).toEqual([]);
    });

    it('records a pending entry on hello and alerts via badges', async () => {
        const port = harness.connect('sibling');
        await flush();

        await port.receive({ type: 'asbplayer-external-hello', name: 'Sibling' });

        expect(approvalFrames(port)).toEqual([
            { type: 'asbplayer-external-approval', approved: false },
            { type: 'asbplayer-external-approval', approved: false },
        ]);
        expect((await harness.pendingEntries())['sibling']).toEqual({
            name: 'Sibling',
            requestedAt: expect.any(Number),
        });
        expect(harness.lastGlobalBadgeText()).toEqual('!');
        expect(harness.badgeAction.setBadgeText).toHaveBeenCalledWith({ tabId: 1, text: '!' });
        expect(harness.badgeAction.setBadgeText).toHaveBeenCalledWith({ tabId: 2, text: '!' });
    });

    it('does not badge video tabs when there are no active video elements', async () => {
        harness.videoElements = [];
        const port = harness.connect('sibling');
        await flush();

        await port.receive({ type: 'asbplayer-external-hello', name: 'Sibling' });

        expect(harness.lastGlobalBadgeText()).toEqual('!');
        expect(harness.badgeAction.setBadgeText).not.toHaveBeenCalledWith({ tabId: 1, text: '!' });
    });

    it('answers hello from an approved extension without recording a pending entry', async () => {
        await harness.approve('sibling', 'Sibling');
        const port = harness.connect('sibling');
        await flush();

        await port.receive({ type: 'asbplayer-external-hello', name: 'Sibling' });

        expect(approvalFrames(port)).toEqual([
            { type: 'asbplayer-external-approval', approved: true },
            { type: 'asbplayer-external-approval', approved: true },
        ]);
        expect(Object.keys(await harness.pendingEntries())).toEqual([]);
    });

    it('stores a hello name from an approved extension on its approval entry', async () => {
        await harness.approve('sibling', 'Sibling');
        const port = harness.connect('sibling');
        await flush();

        await port.receive({ type: 'asbplayer-external-hello', name: 'Renamed Sibling' });

        expect((await harness.approvedEntries())['sibling']).toEqual({
            name: 'Renamed Sibling',
            approvedAt: expect.any(Number),
        });
        expect(Object.keys(await harness.pendingEntries())).toEqual([]);
    });

    it('dispatches commands from approved extensions and posts the response', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');
        await flush();

        harness.dispatcher.dispatchCommand.mockResolvedValueOnce({
            command: 'response',
            messageId: 'm1',
            body: { media: [] },
        });
        await port.receive({ command: 'get-bound-media', messageId: 'm1', body: {} });

        expect(harness.dispatcher.dispatchCommand).toHaveBeenCalledWith({
            command: 'get-bound-media',
            messageId: 'm1',
            body: {},
        });
        expect(port.responses()).toEqual([{ command: 'response', messageId: 'm1', body: { media: [] } }]);
    });

    it('answers dispatch failures with an error body', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');
        await flush();

        harness.dispatcher.dispatchCommand.mockRejectedValueOnce(new Error('handler failed'));
        await port.receive({ command: 'seek-timestamp', messageId: 'm2', body: {} });

        expect(port.responses()).toEqual([{ command: 'response', messageId: 'm2', body: { error: 'handler failed' } }]);
    });

    it('does not respond when the dispatcher does not handle the command', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');
        await flush();

        harness.dispatcher.dispatchCommand.mockResolvedValueOnce(undefined);
        await port.receive({ command: 'unknown-command', messageId: 'm3', body: {} });

        expect(port.responses()).toEqual([]);
    });

    it('ignores malformed frames', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');
        await flush();

        await port.receive({});
        await port.receive({ command: 'get-bound-media', body: {} });
        await port.receive('not an object');

        expect(harness.dispatcher.dispatchCommand).not.toHaveBeenCalled();
        expect(port.responses()).toEqual([]);
    });

    it('approves an external extension with an open port by reacting to the storage change', async () => {
        const port = harness.connect('sibling');
        await flush();
        await port.receive({ type: 'asbplayer-external-hello', name: 'Sibling' });
        await flush();

        await harness.externalConnectionsChanged(harness.approvedState('sibling', 'Sibling'));

        expect(approvalFrames(port)).toEqual([
            { type: 'asbplayer-external-approval', approved: false },
            { type: 'asbplayer-external-approval', approved: false },
            { type: 'asbplayer-external-approval', approved: true },
        ]);

        harness.dispatcher.dispatchCommand.mockResolvedValueOnce({ command: 'response', messageId: 'm4', body: {} });
        await port.receive({ command: 'get-bound-media', messageId: 'm4', body: {} });
        expect(port.responses()).toEqual([{ command: 'response', messageId: 'm4', body: {} }]);
    });

    it('revokes an external extension with an open port and stops dispatching its commands', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');
        await flush();

        await harness.externalConnectionsChanged(harness.emptyState());

        expect(approvalFrames(port)).toEqual([
            { type: 'asbplayer-external-approval', approved: true },
            { type: 'asbplayer-external-approval', approved: false },
        ]);

        harness.dispatcher.dispatchCommand.mockResolvedValueOnce({ command: 'response', messageId: 'm5', body: {} });
        await port.receive({ command: 'get-bound-media', messageId: 'm5', body: {} });
        expect(port.responses()).toEqual([]);
    });

    it('notifies every open port of an external extension', async () => {
        const port1 = harness.connect('sibling');
        const port2 = harness.connect('sibling');
        await flush();
        const port1Frames = approvalFrames(port1);
        const port2Frames = approvalFrames(port2);

        await harness.externalConnectionsChanged(harness.approvedState('sibling'));

        expect(approvalFrames(port1)).toEqual([
            ...port1Frames,
            { type: 'asbplayer-external-approval', approved: true },
        ]);
        expect(approvalFrames(port2)).toEqual([
            ...port2Frames,
            { type: 'asbplayer-external-approval', approved: true },
        ]);
    });

    it('does not fail when posting to a port that disconnects concurrently', async () => {
        const port = harness.connect('sibling');
        await flush();
        const postedBeforeDisconnect = port.posted.length;
        port.disconnect();

        await harness.externalConnectionsChanged(harness.approvedState('sibling'));

        expect(port.posted).toHaveLength(postedBeforeDisconnect);
    });

    it('clears external connection badges once no pending requests remain', async () => {
        const port = harness.connect('sibling');
        await flush();
        await port.receive({ type: 'asbplayer-external-hello', name: 'Sibling' });
        await flush();
        expect(harness.lastGlobalBadgeText()).toEqual('!');

        await harness.externalConnectionsChanged(harness.emptyState());
        await flush();

        expect(harness.lastGlobalBadgeText()).toEqual('');
        expect(harness.badgeAction.setBadgeText).toHaveBeenCalledWith({ tabId: 1, text: '' });
        expect(harness.badgeAction.setBadgeText).toHaveBeenCalledWith({ tabId: 2, text: '' });
    });

    it('prunes expired pending requests and caps the number retained', async () => {
        const now = Date.now();
        const pending: ExternalConnectionsState['pending'] = {};

        for (let i = 1; i <= 12; i++) {
            pending[`recent${i}`] = { name: `Recent ${i}`, requestedAt: now - i * 60_000 };
        }

        pending['expired'] = { name: 'Expired', requestedAt: now - 25 * 60 * 60 * 1000 };
        await harness.seedPending(pending);
        const port = harness.connect('newcomer');
        await flush();

        await port.receive({ type: 'asbplayer-external-hello', name: 'Newcomer' });

        const pendingEntries = await harness.pendingEntries();
        expect(Object.keys(pendingEntries)).toHaveLength(10);
        expect(pendingEntries['newcomer']).toEqual({ name: 'Newcomer', requestedAt: expect.any(Number) });
        expect(pendingEntries['recent1']).toBeDefined();
        expect(pendingEntries['recent9']).toBeDefined();
        expect(pendingEntries['recent10']).toBeUndefined();
        expect(pendingEntries['recent12']).toBeUndefined();
        expect(pendingEntries['expired']).toBeUndefined();
    });

    it('disconnects and ignores ports without a sender ID', async () => {
        const port = harness.connect(undefined);

        expect(port.disconnected).toEqual(true);
        expect(port.posted).toEqual([]);
        expect(port.approvalFrames()).toEqual([]);
    });
});

function approvalFrames(port: FakePort) {
    return port.approvalFrames();
}
