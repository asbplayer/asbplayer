import { afterEach, beforeEach, describe, expect, jest } from '@jest/globals';
import type { VideoTabModel } from '@project/common';
import type { ExternalConnectionsState } from '@project/common/global-state';
import type { SettingsProvider } from '@project/common/settings';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import {
    deniedRequestCooldownMs,
    deniedRequestCooldownsKey,
    ExternalConnectionCoordinator,
} from '@project/extension/src/services/external-connection-coordinator';
import { ExtensionBadgeController } from '@project/extension/src/services/extension-badge-controller';
import { ExtensionGlobalStateProvider } from '@project/extension/src/services/extension-global-state-provider';
import { MockStorageArea } from '@project/extension/src/services/mock-storage-area';
import { MockLockManager } from '@project/extension/src/services/mock-lock-manager';
import { ExternalCommandDispatcher } from '@project/common/external-commands/dispatcher';
import { externalExtensionPortName } from '@project/common/external-commands/external-api';
import openRpcDocument from '@project/common/external-commands/openrpc-document';

const flush = async () => {
    for (let i = 0; i < 20; i++) {
        await Promise.resolve();
    }
};

interface RpcResponse {
    jsonrpc: '2.0';
    id: string;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
}

class FakePort {
    readonly sender = { id: undefined as string | undefined };
    readonly name: string;
    disconnected = false;
    readonly posted: unknown[] = [];
    private readonly _messageListeners: ((message: unknown) => void)[] = [];
    private readonly _disconnectListeners: (() => void)[] = [];
    private _nextRequestId = 0;

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

    constructor(id?: string, name = externalExtensionPortName) {
        this.sender.id = id;
        this.name = name;
    }

    async receive(message: unknown) {
        for (const listener of [...this._messageListeners]) {
            listener(message);
        }

        await flush();
    }

    simulateDisconnectFromClientSide() {
        this.disconnected = true;
        for (const listener of this._disconnectListeners) {
            listener();
        }
    }

    disconnect() {
        this.disconnected = true;

        // As per https://developer.chrome.com/docs/extensions/reference/api/runtime#type-Port
        // disconnect() does not call the onDisconnect listeners, so they are intentionally not called here
    }

    rpcResponses(): RpcResponse[] {
        return this.posted.filter((message): message is RpcResponse => {
            return (
                typeof message === 'object' && message !== null && (message as { jsonrpc?: unknown }).jsonrpc === '2.0'
            );
        });
    }

    responseFor(id: string): RpcResponse | undefined {
        return this.rpcResponses().find((response) => response.id === id);
    }

    /** Sends a JSON-RPC request and returns its id. */
    async request(method: string, params?: object): Promise<string> {
        const id = `id-${this._nextRequestId++}`;
        await this.receive({ jsonrpc: '2.0', method, params, id });
        return id;
    }

    async notify(method: string, params?: object) {
        await this.receive({ jsonrpc: '2.0', method, params });
    }
}

class Harness {
    readonly storage = new MockStorageArea();
    readonly sessionStorage = new MockStorageArea();
    readonly locks = new MockLockManager();
    readonly globalStateProvider = new ExtensionGlobalStateProvider(this.storage, this.locks);
    readonly badgeAction = { setBadgeText: jest.fn() };
    readonly badgeController = new ExtensionBadgeController(this.badgeAction);
    readonly dispatcher = new ExternalCommandDispatcher();
    videoElements: VideoTabModel[] = [
        { id: 1, src: 'src1', subscribed: true, synced: false, loadedSubtitles: false },
        { id: 2, src: 'src2', subscribed: true, synced: false, loadedSubtitles: false },
    ];
    coordinator: ExternalConnectionCoordinator;

    private readonly _connectListeners: ((port: unknown) => void)[] = [];

    constructor() {
        (globalThis as any).browser = {
            runtime: {
                onConnectExternal: {
                    addListener: (listener: (port: unknown) => void) => this._connectListeners.push(listener),
                },
            },
            storage: {
                local: this.storage,
                session: this.sessionStorage,
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

    connect(id?: string, name = externalExtensionPortName): FakePort {
        const port = new FakePort(id, name);

        for (const listener of [...this._connectListeners]) {
            listener(port);
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

    async deniedRequestCooldowns(): Promise<{ [extensionId: string]: number }> {
        return (await this.sessionStorage.get(deniedRequestCooldownsKey))[deniedRequestCooldownsKey] ?? {};
    }

    emptyState(): ExternalConnectionsState {
        return { approved: {}, pending: {} };
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
    let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        harness = new Harness();
    });

    afterEach(() => {
        harness?.teardown();
    });

    it('does not send anything to an unapproved connection until it identifies itself', async () => {
        const port = harness.connect('sibling');
        await flush();
        const dispatch = jest.spyOn(harness.dispatcher, 'dispatchJsonRpc');

        expect(port.rpcResponses()).toEqual([]);

        await port.request('get-bound-media');

        expect(dispatch).not.toHaveBeenCalled();
        // Not even a pending request, because the external extension never identified itself.
        expect(Object.keys(await harness.pendingEntries())).toEqual([]);
    });

    it('does not report pending for a connection with no outstanding approval request', async () => {
        const port = harness.connect('sibling');

        const id = await port.request('approval-state');

        expect(port.responseFor(id)).toEqual({ jsonrpc: '2.0', id, result: { state: 'denied' } });
        expect(port.disconnected).toBe(true);
    });

    it('answers initialize from an unapproved connection with pending and alerts via badges', async () => {
        const port = harness.connect('sibling');

        const id = await port.request('initialize', { name: 'Sibling' });

        expect(port.responseFor(id)).toEqual({ jsonrpc: '2.0', id, result: { state: 'pending' } });
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

        await port.request('initialize', { name: 'Sibling' });

        expect(harness.lastGlobalBadgeText()).toEqual('!');
        expect(harness.badgeAction.setBadgeText).not.toHaveBeenCalledWith({ tabId: 1, text: '!' });
    });

    it('answers initialize from an approved extension with approved without recording a pending entry', async () => {
        await harness.approve('sibling', 'Sibling');
        const port = harness.connect('sibling');

        const id = await port.request('initialize', { name: 'Sibling' });

        expect(port.responseFor(id)).toEqual({ jsonrpc: '2.0', id, result: { state: 'approved' } });
        expect(Object.keys(await harness.pendingEntries())).toEqual([]);
    });

    it('answers initialize failures with an internal error instead of pretending the request is pending', async () => {
        const port = harness.connect('sibling');
        const failure = new Error('Concurrent update when writing key externalConnections');
        (harness.globalStateProvider as any).updateWithLocking = () => Promise.reject(failure);

        const id = await port.request('initialize', { name: 'Sibling' });

        expect(consoleErrorSpy.mock.calls.some((args: unknown[]) => args.includes(failure))).toBe(true);
        expect(port.responseFor(id)).toEqual({
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: 'Internal error', data: failure.message },
        });
        expect(Object.keys(await harness.pendingEntries())).toEqual([]);
    });

    it('does not record a pending request while a denial cooldown is active', async () => {
        const port = harness.connect('sibling');

        await port.request('initialize', { name: 'Sibling' });
        expect(Object.keys(await harness.pendingEntries())).toEqual(['sibling']);

        // The user denies the request.
        await harness.externalConnectionsChanged(harness.emptyState());
        await flush();
        expect(Object.keys(await harness.deniedRequestCooldowns())).toEqual(['sibling']);

        // The extension requests again within the cooldown window.
        const id = await port.request('initialize', { name: 'Sibling' });

        expect(Object.keys(await harness.pendingEntries())).toEqual([]);
        expect(harness.lastGlobalBadgeText()).toEqual('');
        expect(port.responseFor(id)).toEqual({ jsonrpc: '2.0', id, result: { state: 'denied' } });
        expect(port.disconnected).toBe(true);
    });

    it('once denied, the next approval-state poll returns denied and closes the port', async () => {
        const port = harness.connect('sibling');
        await port.request('initialize', { name: 'Sibling' });
        await harness.externalConnectionsChanged(harness.emptyState());
        await flush();

        const id = await port.request('approval-state');

        expect(port.responseFor(id)).toEqual({ jsonrpc: '2.0', id, result: { state: 'denied' } });
        expect(port.disconnected).toBe(true);
    });

    it('closes the port when a denied approval-state notification is received', async () => {
        const port = harness.connect('sibling');
        await port.request('initialize', { name: 'Sibling' });
        await harness.externalConnectionsChanged(harness.emptyState());
        await flush();

        await port.notify('approval-state');

        expect(port.disconnected).toBe(true);
        expect(harness.coordinator.portsForExtensionId('sibling')).not.toContain(port);
    });

    it('allows a denied extension to request again after the cooldown expires', async () => {
        await harness.sessionStorage.set({
            [deniedRequestCooldownsKey]: { sibling: Date.now() - deniedRequestCooldownMs - 1 },
        });
        const port = harness.connect('sibling');

        await port.request('initialize', { name: 'Newcomer' });

        expect((await harness.pendingEntries())['sibling']).toEqual({
            name: 'Newcomer',
            requestedAt: expect.any(Number),
        });
    });

    it('does not set a denial cooldown when a pending request is approved', async () => {
        const port = harness.connect('sibling');

        await port.request('initialize', { name: 'Sibling' });
        await harness.approve('sibling');
        await flush();

        expect(Object.keys(await harness.deniedRequestCooldowns())).toEqual([]);
    });

    it('stores an initialize name from an approved extension on its approval entry', async () => {
        await harness.approve('sibling', 'Sibling');
        const port = harness.connect('sibling');

        await port.request('initialize', { name: 'Renamed Sibling' });

        expect((await harness.approvedEntries())['sibling']).toEqual({
            name: 'Renamed Sibling',
            approvedAt: expect.any(Number),
        });
        expect(Object.keys(await harness.pendingEntries())).toEqual([]);
    });

    it('dispatches commands from approved extensions and answers with a result', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');
        const dispatch = jest.spyOn(harness.dispatcher, 'dispatchJsonRpc');
        harness.dispatcher.setHandlers({ onGetBoundMedia: async () => [] });

        const id = await port.request('get-bound-media', {});

        expect(dispatch).toHaveBeenCalledWith({
            jsonrpc: '2.0',
            method: 'get-bound-media',
            params: {},
            id,
        });
        expect(port.responseFor(id)).toEqual({ jsonrpc: '2.0', id, result: { media: [] } });
    });

    it('answers commands sent before approval with not approved', async () => {
        const port = harness.connect('sibling');
        const dispatch = jest.spyOn(harness.dispatcher, 'dispatchJsonRpc');

        const id = await port.request('get-bound-media', {});

        expect(dispatch).not.toHaveBeenCalled();
        expect(port.responseFor(id)).toEqual({
            jsonrpc: '2.0',
            id,
            error: { code: -32002, message: 'Not approved' },
        });
    });

    it('answers dispatch failures with an internal error', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');
        harness.dispatcher.setHandlers({
            onSeekTimestamp: async () => {
                throw new Error('handler failed');
            },
        });

        const id = await port.request('seek-timestamp', { timestamp: 30 });

        expect(port.responseFor(id)).toEqual({
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: 'Internal error', data: 'handler failed' },
        });
    });

    it('answers invalid handler results with an internal error', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');
        harness.dispatcher.setHandlers({
            onGetBoundMedia: async () => [{ id: 1 } as any],
        });

        const id = await port.request('get-bound-media', {});

        expect(port.responseFor(id)).toMatchObject({
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: 'Internal error', data: expect.any(Array) },
        });
    });

    it('answers unknown methods with method not found', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');

        const id = await port.request('unknown-command', {});

        expect(port.responseFor(id)).toEqual({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: 'Method not found' },
        });
    });

    it('answers client-info with the supported protocols', async () => {
        const port = harness.connect('sibling');

        const id = await port.request('client-info', {});

        expect(port.responseFor(id)).toEqual({
            jsonrpc: '2.0',
            id,
            result: { protocols: ['jsonrpc-2.0'] },
        });
    });

    it('answers unhandled commands with method not found', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');

        const id = await port.request('get-bound-media', {});

        expect(port.responseFor(id)).toEqual({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: 'Method not found' },
        });
    });

    it('answers invalid params with invalid params', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');

        const id = await port.request('mine-subtitle', { fields: {}, postMineAction: 99 });

        expect(port.responseFor(id)).toMatchObject({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Invalid params' },
        });
    });

    it('answers rpc.discover with the OpenRPC document', async () => {
        const port = harness.connect('sibling');

        const id = await port.request('rpc.discover');

        expect(port.responseFor(id)).toEqual({
            jsonrpc: '2.0',
            id,
            result: openRpcDocument,
        });
    });

    it('answers JSON-RPC frames with an unusable id with invalid request', async () => {
        const port = harness.connect('sibling');

        await port.receive({ jsonrpc: '2.0', method: 'initialize', id: 1 });
        await port.receive({ jsonrpc: '2.0', id: 'malformed' });

        expect(port.rpcResponses()).toEqual([
            {
                jsonrpc: '2.0',
                id: null,
                error: { code: -32600, message: 'Invalid request' },
            },
            {
                jsonrpc: '2.0',
                id: null,
                error: { code: -32600, message: 'Invalid request' },
            },
        ]);
    });

    it('ignores malformed frames and legacy frames', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');
        const dispatch = jest.spyOn(harness.dispatcher, 'dispatchJsonRpc');

        await port.receive({});
        await port.receive({ command: 'get-bound-media', body: {} });
        await port.receive({ jsonrpc: '1.0', method: 'get-bound-media', id: 'bad' });
        await port.receive('not an object');

        expect(dispatch).not.toHaveBeenCalled();
        expect(port.rpcResponses()).toEqual([]);
    });

    it('dispatches notifications without answering, even on failure', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');
        const dispatch = jest.spyOn(harness.dispatcher, 'dispatchJsonRpc');
        harness.dispatcher.setHandlers({
            onMineSubtitle: async () => {
                throw new Error('handler failed');
            },
        });

        await port.notify('mine-subtitle', { fields: { Front: 'ねこ' }, postMineAction: 2 });

        expect(dispatch).toHaveBeenCalled();
        expect(port.rpcResponses()).toEqual([]);
    });

    it('approves an external extension with an open port without notifying it', async () => {
        const port = harness.connect('sibling');
        await port.request('initialize', { name: 'Sibling' });

        await harness.externalConnectionsChanged(harness.approvedState('sibling', 'Sibling'));

        expect(port.rpcResponses()).toHaveLength(1); // Only the initialize response; no push on approval.

        harness.dispatcher.setHandlers({ onGetBoundMedia: async () => [] });
        await port.request('get-bound-media', {});
        expect(port.rpcResponses()).toHaveLength(2);
    });

    it('revokes an external extension with an open port by closing it and stops dispatching its commands', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');

        await harness.externalConnectionsChanged(harness.emptyState());

        expect(port.disconnected).toEqual(true);
        expect(harness.coordinator.portsForExtensionId('sibling')).not.toContain(port);

        const dispatch = jest.spyOn(harness.dispatcher, 'dispatchJsonRpc');
        await port.request('get-bound-media', {});
        expect(dispatch).not.toHaveBeenCalled();
        expect(port.rpcResponses()).toEqual([]);
    });

    it('disconnects every open port of an external extension when revoked', async () => {
        const port1 = harness.connect('sibling');
        const port2 = harness.connect('sibling');
        await harness.approve('sibling');

        await harness.externalConnectionsChanged(harness.emptyState());

        expect(port1.disconnected).toEqual(true);
        expect(port2.disconnected).toEqual(true);
        expect(harness.coordinator.portsForExtensionId('sibling')).not.toContain(port1);
        expect(harness.coordinator.portsForExtensionId('sibling')).not.toContain(port2);
    });

    it('does not fail when posting a response to a port that disconnects concurrently', async () => {
        await harness.approve('sibling');
        const port = harness.connect('sibling');
        const postedBeforeDisconnect = port.posted.length;
        port.disconnect();

        await port.request('get-bound-media', {});

        expect(port.posted).toHaveLength(postedBeforeDisconnect);
    });

    it('clears external connection badges once no pending requests remain', async () => {
        const port = harness.connect('sibling');
        await port.request('initialize', { name: 'Sibling' });
        await flush();
        expect(harness.lastGlobalBadgeText()).toEqual('!');

        await harness.externalConnectionsChanged(harness.emptyState());
        await flush();

        expect(harness.lastGlobalBadgeText()).toEqual('');
        expect(harness.badgeAction.setBadgeText).toHaveBeenCalledWith({ tabId: 1, text: null });
        expect(harness.badgeAction.setBadgeText).toHaveBeenCalledWith({ tabId: 2, text: null });
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

        await port.request('initialize', { name: 'Newcomer' });

        const pendingEntries = await harness.pendingEntries();
        expect(Object.keys(pendingEntries)).toHaveLength(10);
        expect(pendingEntries['newcomer']).toEqual({ name: 'Newcomer', requestedAt: expect.any(Number) });
        expect(pendingEntries['recent1']).toBeDefined();
        expect(pendingEntries['recent9']).toBeDefined();
        expect(pendingEntries['recent10']).toBeUndefined();
        expect(pendingEntries['recent12']).toBeUndefined();
        expect(pendingEntries['expired']).toBeUndefined();
        // Pruning a pending entry without approval counts as a denial.
        expect((await harness.deniedRequestCooldowns())['expired']).toBeDefined();
    });

    it('disconnects and ignores ports without a sender ID', async () => {
        const port = harness.connect(undefined);

        expect(port.disconnected).toEqual(true);
        expect(port.posted).toEqual([]);
    });

    it('disconnects and ignores ports with an unexpected name', async () => {
        const port = harness.connect('sibling', 'asbplayer-external-v2');

        expect(port.disconnected).toEqual(true);
        expect(port.posted).toEqual([]);
    });

    it('cleans up ports when a client disconnects', async () => {
        const port = harness.connect('sibling');

        expect(harness.coordinator.portsForExtensionId('sibling')).toContain(port);
        port.simulateDisconnectFromClientSide();
        expect(port.disconnected).toEqual(true);
        expect(harness.coordinator.portsForExtensionId('sibling')).not.toContain(port);
    });
});
