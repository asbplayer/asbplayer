import { asbError } from '@project/common/util/log';
import type { ExternalConnectionsState, ExternalMethodUsage, GlobalStateProvider } from '@project/common/global-state';
import {
    activePendingExternalConnections,
    approvedExternalConnections,
    deniedRequestCooldownMs,
    externalConnectionsPermissionSignature,
    mutateExternalConnections,
} from '@project/common/global-state';
import type { ExternalCommand } from '@project/common/external-commands';
import {
    externalApiMethod,
    externalExtensionPortName,
    isInvalidJsonRpcRequest,
    jsonRpcError,
    jsonRpcErrorCodes,
    jsonRpcProtocol,
    jsonRpcSuccess,
    parseJsonRpcIncomingMessage,
} from '@project/common/external-commands/external-api';
import type { ExternalApiMethodName, JsonRpcIncomingMessage } from '@project/common/external-commands/external-api';
import { ExternalCommandDispatcher } from '@project/common/external-commands/dispatcher';
import { externalCommandHandlers } from '@project/extension/src/services/external-command-handlers';
import type { SettingsProvider } from '@project/common/settings';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import type { ExtensionBadgeController } from '@project/extension/src/services/extension-badge-controller';

// Pending requests expire after this long, and at most this many are retained, so that
// unapproved requests cannot accumulate indefinitely.
const maxPendingRequests = 10;

// A denied extension may not re-request approval for this long. Session storage is used so
// that cooldowns survive service worker restarts but reset with each browser session.
export const deniedRequestCooldownsKey = 'externalConnectionDeniedCooldowns';

const badgeReason = 'externalConnections';

// Usage is buffered in memory and flushed well within the service worker's 30-second idle
// timeout, so a flush scheduled by recent RPC activity always runs before suspension.
export const externalConnectionUsageFlushMs = 5_000;

interface PendingExternalUsage {
    lastUsedAt: number;
    methods: Record<string, ExternalMethodUsage>;
}

class ExternalRpcError extends Error {
    constructor(
        readonly code: number,
        message: string,
        readonly data?: unknown
    ) {
        super(message);
    }
}

type ApprovalState = 'approved' | 'pending' | 'denied';

/**
 * Manages external browser extensions connecting over `browser.runtime.onConnectExternal`.
 *
 * Approvals are keyed by extension ID and persisted in `externalConnections`; surfaces write that
 * state and this coordinator reacts to it. The port uses JSON-RPC 2.0.
 */
export class ExternalConnectionCoordinator {
    private readonly _globalStateProvider: GlobalStateProvider;
    private readonly _tabRegistry: TabRegistry;
    private readonly _badgeController: ExtensionBadgeController;
    private readonly _dispatcher: ExternalCommandDispatcher;
    private readonly _ports = new Map<string, Set<Browser.runtime.Port>>();
    private _pendingUsage = new Map<string, PendingExternalUsage>();
    private _usageFlushTimer?: ReturnType<typeof setTimeout>;
    // onUpdated carries no oldValue, so track approved IDs across updates to detect additions/revocations.
    private _lastApprovedIds?: Set<string>;
    private _lastPermissionSignature?: string;

    constructor({
        globalStateProvider,
        tabRegistry,
        settings,
        badgeController,
        dispatcher,
    }: {
        globalStateProvider: GlobalStateProvider;
        tabRegistry: TabRegistry;
        settings: SettingsProvider;
        badgeController: ExtensionBadgeController;
        /** Defaults to a dispatcher wired with the extension's external command handlers. */
        dispatcher?: ExternalCommandDispatcher;
    }) {
        this._globalStateProvider = globalStateProvider;
        this._tabRegistry = tabRegistry;
        this._badgeController = badgeController;
        this._dispatcher = dispatcher ?? new ExternalCommandDispatcher();

        if (dispatcher === undefined) {
            this._dispatcher.setHandlers(externalCommandHandlers(settings, tabRegistry));
        }

        browser.runtime.onConnectExternal.addListener((port) => this._onConnectExternal(port));
        this._globalStateProvider.onUpdated((state) => {
            if (state.externalConnections !== undefined) {
                void this._onExternalConnectionsUpdated(state.externalConnections);
            }
        });
        void this._globalStateProvider
            .get(['externalConnections'])
            .then((state) => this._seedLastApprovedIds(state.externalConnections));
    }

    /** Recomputes this feature's badge contributions from global state. */
    async updateBadge(): Promise<void> {
        const [{ externalConnections }, videoElements] = await Promise.all([
            this._globalStateProvider.get(['externalConnections']),
            this._tabRegistry.activeVideoElements(),
        ]);

        const pendingCount = Object.entries(
            activePendingExternalConnections(externalConnections ?? {}, Date.now())
        ).length;
        this._badgeController.setGlobalAlert(badgeReason, pendingCount > 0);
        this._badgeController.setTabAlerts(
            pendingCount > 0 ? videoElements.map((videoElement) => videoElement.id) : []
        );
    }

    /**
     * Allows tests to inspect tracked ports.
     */
    portsForExtensionId(extensionId: string): Browser.runtime.Port[] {
        return [...(this._ports.get(extensionId) ?? [])];
    }

    private _onConnectExternal(port: Browser.runtime.Port) {
        if (port.name !== externalExtensionPortName) {
            port.disconnect();
            return;
        }

        const senderId = port.sender?.id;

        if (senderId === undefined) {
            port.disconnect();
            return;
        }

        let ports = this._ports.get(senderId);

        if (ports === undefined) {
            ports = new Set();
            this._ports.set(senderId, ports);
        }

        ports.add(port);
        port.onDisconnect.addListener(() => {
            ports.delete(port);

            if (ports.size === 0) {
                this._ports.delete(senderId);
                void this.flushUsage();
                void this._recordDisconnected(senderId);
            }
        });

        port.onMessage.addListener((message) => void this._onMessage(senderId, port, message));
    }

    private async _onMessage(senderId: string, port: Browser.runtime.Port, message: unknown) {
        const incoming = parseJsonRpcIncomingMessage(message);

        if (incoming === undefined) {
            if (isInvalidJsonRpcRequest(message)) {
                // The id is unusable, so answer with null as JSON-RPC requires.
                this._post(port, jsonRpcError(null, jsonRpcErrorCodes.invalidRequest, 'Invalid request'));
            }

            return;
        }

        let result: unknown;
        let error: ExternalRpcError | undefined;

        try {
            result = await this._rpc(senderId, incoming.method, incoming.params, incoming.id);
        } catch (thrown) {
            error =
                thrown instanceof ExternalRpcError
                    ? thrown
                    : new ExternalRpcError(
                          jsonRpcErrorCodes.internalError,
                          'Internal error',
                          thrown instanceof Error ? thrown.message : String(thrown)
                      );

            if (error.code === jsonRpcErrorCodes.internalError) {
                asbError('external-connection', 'Failed to process external request:', thrown);
            }
        }

        if (error !== undefined) {
            if (incoming.id !== undefined) {
                this._post(port, jsonRpcError(incoming.id, error.code, error.message, error.data));
            }

            return;
        }

        if (incoming.id !== undefined) {
            this._post(port, jsonRpcSuccess(incoming.id, result));
        }

        if ((result as { state?: string } | undefined)?.state === 'denied') {
            this._disconnectPort(senderId, port);
        }
    }

    private async _rpc(senderId: string, method: string, params: unknown, id: string | undefined) {
        const methodDef = externalApiMethod(method);

        if (methodDef === undefined) {
            throw new ExternalRpcError(jsonRpcErrorCodes.methodNotFound, 'Method not found');
        }

        this._recordUsage(senderId, method);

        const knownMethod = method as ExternalApiMethodName;
        const paramsSchema = methodDef.paramsSchema;

        switch (knownMethod) {
            case 'rpc.discover': {
                const { default: openRpcDocument } = await import('@project/common/external-commands/openrpc-document');
                return openRpcDocument;
            }
            case 'client-info': {
                const parsed = paramsSchema.safeParse(params ?? {});

                if (!parsed.success) {
                    throw new ExternalRpcError(jsonRpcErrorCodes.invalidParams, 'Invalid params', parsed.error.issues);
                }

                return { protocols: [jsonRpcProtocol] };
            }
            case 'initialize': {
                const parsed = paramsSchema.safeParse(params ?? {});

                if (!parsed.success) {
                    throw new ExternalRpcError(jsonRpcErrorCodes.invalidParams, 'Invalid params', parsed.error.issues);
                }

                return { state: await this._initialize(senderId, parsed.data as { name?: string }) };
            }
            case 'approval-state': {
                const parsed = paramsSchema.safeParse(params ?? {});

                if (!parsed.success) {
                    throw new ExternalRpcError(jsonRpcErrorCodes.invalidParams, 'Invalid params', parsed.error.issues);
                }

                return { state: await this._approvalState(senderId) };
            }
            default: {
                // Only dispatched commands reach here; a special method without a case fails the typecheck.
                const dispatchedMethod: ExternalCommand['command'] = knownMethod;

                if (!(await this._approvedIds()).has(senderId)) {
                    throw new ExternalRpcError(jsonRpcErrorCodes.notApproved, 'Not approved');
                }

                const request: JsonRpcIncomingMessage =
                    id === undefined
                        ? { jsonrpc: '2.0', method: dispatchedMethod, params }
                        : { jsonrpc: '2.0', method: dispatchedMethod, params, id };

                const response = await this._dispatcher.dispatchAppLevelJsonRpc(request);

                if (response === undefined) {
                    if (id === undefined) {
                        return undefined;
                    }

                    // A request must always be answered.
                    throw new ExternalRpcError(jsonRpcErrorCodes.methodNotFound, 'Method not found');
                }

                if ('error' in response) {
                    throw new ExternalRpcError(response.error.code, response.error.message, response.error.data);
                }

                return response.result;
            }
        }
    }

    private async _approvalState(senderId: string): Promise<ApprovalState> {
        const { externalConnections } = await this._globalStateProvider.get(['externalConnections']);

        if (externalConnections?.[senderId]?.deniedAt !== undefined) {
            return 'denied';
        }

        if (externalConnections?.[senderId]?.approvedAt !== undefined) {
            return 'approved';
        }

        const pending = activePendingExternalConnections(externalConnections ?? {}, Date.now())[senderId];

        if (pending !== undefined) {
            return 'pending';
        }

        return 'denied';
    }

    private async _initialize(senderId: string, params: { name?: string }): Promise<ApprovalState> {
        const name = params.name !== undefined && params.name.length > 0 ? params.name : undefined;
        let approvalState: ApprovalState = 'pending';
        await mutateExternalConnections(this._globalStateProvider, (externalConnections) => {
            const connection = externalConnections[senderId];
            const now = Date.now();
            if (connection !== undefined) {
                if (connection.approvedAt !== undefined) {
                    approvalState = 'approved';
                    externalConnections[senderId] = {
                        ...connection,
                        methods: connection.methods ?? {},
                        name,
                        lastConnectedAt: now,
                    };
                    return true;
                }

                if (connection.deniedAt !== undefined && now - connection.deniedAt < deniedRequestCooldownMs) {
                    approvalState = 'denied';
                    return false;
                }
            }

            approvalState = 'pending';
            const nextConnection =
                connection === undefined
                    ? { methods: {}, name, requestedAt: now, lastConnectedAt: now }
                    : {
                          ...connection,
                          methods: connection.methods ?? {},
                          name,
                          requestedAt: now,
                          lastConnectedAt: now,
                      };
            delete nextConnection.deniedAt;
            delete nextConnection.approvedAt;

            const pruned = this._pruneConnections({ ...externalConnections, [senderId]: nextConnection }, now);
            for (const extensionId of Object.keys(externalConnections)) {
                delete externalConnections[extensionId];
            }
            Object.assign(externalConnections, pruned);
            return true;
        });

        if (approvalState === 'pending') {
            void this.updateBadge();
        }

        return approvalState;
    }

    private async _onExternalConnectionsUpdated(externalConnections: ExternalConnectionsState) {
        this._dropRemovedUsage(externalConnections);

        const signature = externalConnectionsPermissionSignature(externalConnections);

        if (signature === this._lastPermissionSignature) {
            // Usage and connection timestamps changed; nothing that affects approval state did.
            return;
        }

        this._lastPermissionSignature = signature;

        const newApproved = new Set(Object.keys(approvedExternalConnections(externalConnections)));

        if (this._lastApprovedIds === undefined) {
            // The baseline fetch has not resolved yet.
            this._lastApprovedIds = new Set();
        }

        const oldApproved = this._lastApprovedIds;

        for (const extensionId of oldApproved) {
            if (!newApproved.has(extensionId)) {
                this._disconnectPorts(extensionId);
            }
        }

        this._lastApprovedIds = newApproved;

        // Prune expired/capped pending requests left behind by other writers of global state.
        if (this._pendingRequestsNeedPrune(externalConnections, Date.now())) {
            try {
                await this._prunePendingRequests();
            } catch (error) {
                asbError('external-connection', 'Failed to prune pending external connection requests:', error);
            }
        }

        await this.updateBadge();
    }

    private _disconnectPorts(extensionId: string) {
        for (const port of [...(this._ports.get(extensionId) ?? [])]) {
            this._disconnectPort(extensionId, port);
        }
    }

    private _disconnectPort(extensionId: string, port: Browser.runtime.Port) {
        try {
            port.disconnect();
        } catch {
            // Expected if the port disconnects concurrently.
        }
        const ports = this._ports.get(extensionId);
        if (ports != null) {
            ports.delete(port);
            if (ports.size === 0) {
                this._ports.delete(extensionId);
            }
        }
    }

    private _pendingRequestsNeedPrune(connections: ExternalConnectionsState, now: number): boolean {
        return Object.keys(this._pruneConnections(connections, now)).length < Object.keys(connections).length;
    }

    private async _prunePendingRequests(): Promise<void> {
        await mutateExternalConnections(this._globalStateProvider, (externalConnections) => {
            const pruned = this._pruneConnections(externalConnections, Date.now());

            if (Object.keys(pruned).length === Object.keys(externalConnections).length) {
                return false;
            }

            for (const extensionId of Object.keys(externalConnections)) {
                delete externalConnections[extensionId];
            }
            Object.assign(externalConnections, pruned);
            return true;
        });
    }

    private _seedLastApprovedIds(externalConnections: ExternalConnectionsState) {
        if (this._lastApprovedIds !== undefined) {
            // An update already initialized the baseline from newer state.
            return;
        }

        this._lastApprovedIds = new Set(Object.keys(approvedExternalConnections(externalConnections)));
    }

    private _pruneConnections(connections: ExternalConnectionsState, now: number): ExternalConnectionsState {
        // Keep non-expired pending connections
        const prunedPending = Object.fromEntries(
            Object.entries(activePendingExternalConnections(connections, now))
                .sort(([, a], [, b]) => (b?.requestedAt ?? 0) - (a?.requestedAt ?? 0))
                .slice(0, maxPendingRequests)
        );
        const rest = Object.fromEntries(
            Object.entries(connections).filter(
                ([, c]) =>
                    // Keep denied connections in deny cooldown
                    (c.deniedAt !== undefined && now - c.deniedAt < deniedRequestCooldownMs) ||
                    // Keep approved connections
                    c.approvedAt !== undefined
            )
        );
        return { ...prunedPending, ...rest };
    }

    private _dropRemovedUsage(externalConnections: ExternalConnectionsState) {
        for (const extensionId of this._pendingUsage.keys()) {
            if (!(extensionId in externalConnections)) {
                this._pendingUsage.delete(extensionId);
            }
        }
    }

    private _recordUsage(extensionId: string, method: string) {
        const now = Date.now();
        const pending = this._pendingUsage.get(extensionId) ?? { lastUsedAt: now, methods: {} };
        const usage = pending.methods[method] ?? { count: 0, lastUsedAt: now };

        usage.count += 1;
        usage.lastUsedAt = now;
        pending.methods[method] = usage;
        pending.lastUsedAt = now;
        this._pendingUsage.set(extensionId, pending);
        this._scheduleUsageFlush();
    }

    private _scheduleUsageFlush() {
        if (this._usageFlushTimer !== undefined) {
            return;
        }

        this._usageFlushTimer = setTimeout(() => {
            this._usageFlushTimer = undefined;
            void this.flushUsage();
        }, externalConnectionUsageFlushMs);
    }

    /** Persists buffered usage statistics. Also called when the last port for an extension closes. */
    async flushUsage(): Promise<void> {
        if (this._pendingUsage.size === 0) {
            return;
        }

        const pending = this._pendingUsage;
        this._pendingUsage = new Map();

        try {
            await mutateExternalConnections(this._globalStateProvider, (externalConnections) => {
                let changed = false;

                for (const [extensionId, usage] of pending) {
                    const connection = externalConnections[extensionId];

                    if (connection === undefined) {
                        // The connection was removed while its usage was buffered.
                        continue;
                    }

                    connection.methods ??= {};
                    connection.lastUsedAt = Math.max(connection.lastUsedAt ?? 0, usage.lastUsedAt);

                    for (const [method, methodUsage] of Object.entries(usage.methods)) {
                        const existing = connection.methods[method];

                        if (existing === undefined) {
                            connection.methods[method] = { ...methodUsage };
                        } else {
                            existing.count += methodUsage.count;
                            existing.lastUsedAt = Math.max(existing.lastUsedAt, methodUsage.lastUsedAt);
                        }
                    }

                    changed = true;
                }

                return changed;
            });
        } catch (error) {
            this._mergePendingUsage(pending);
            asbError('external-connection', 'Failed to flush external connection usage:', error);
        }
    }

    private _mergePendingUsage(pending: Map<string, PendingExternalUsage>) {
        for (const [extensionId, usage] of pending) {
            const existing = this._pendingUsage.get(extensionId) ?? { lastUsedAt: usage.lastUsedAt, methods: {} };
            existing.lastUsedAt = Math.max(existing.lastUsedAt, usage.lastUsedAt);

            for (const [method, methodUsage] of Object.entries(usage.methods)) {
                const existingMethod = existing.methods[method];

                if (existingMethod === undefined) {
                    existing.methods[method] = { ...methodUsage };
                } else {
                    existingMethod.count += methodUsage.count;
                    existingMethod.lastUsedAt = Math.max(existingMethod.lastUsedAt, methodUsage.lastUsedAt);
                }
            }

            this._pendingUsage.set(extensionId, existing);
        }
    }

    private async _recordDisconnected(extensionId: string) {
        try {
            await mutateExternalConnections(this._globalStateProvider, (externalConnections) => {
                const connection = externalConnections[extensionId];

                if (connection === undefined) {
                    return false;
                }

                connection.lastDisconnectedAt = Date.now();
                return true;
            });
        } catch (error) {
            asbError('external-connection', `Failed to record disconnect for ${extensionId}:`, error);
        }
    }

    private async _approvedIds(): Promise<Set<string>> {
        const { externalConnections } = await this._globalStateProvider.get(['externalConnections']);
        return new Set(Object.keys(approvedExternalConnections(externalConnections)));
    }

    private _post(port: Browser.runtime.Port, message: unknown) {
        try {
            port.postMessage(message);
        } catch {
            // The port may disconnect concurrently while posting; expected teardown, not an error.
        }
    }
}
