import { asbError } from '@project/common/util/log';
import type { ExternalConnectionsState, GlobalStateProvider } from '@project/common/global-state';
import {
    activePendingExternalConnections,
    approvedExternalConnections,
    deniedRequestCooldownMs,
    mutateExternalConnections,
} from '@project/common/global-state';
import type { ExternalCommand } from '@project/common/external-commands';
import {
    externalApiMethods,
    generateOpenRpcDocument,
    jsonRpcErrorCodes,
    parseJsonRpcIncomingMessage,
} from '@project/common/external-commands/external-api';
import { ExternalCommandDispatcher } from '@project/common/external-commands/dispatcher';
import { externalCommandHandlers } from '@project/extension/src/services/external-command-handlers';
import type { SettingsProvider } from '@project/common/settings';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import type { ExtensionBadgeController } from '@project/extension/src/services/extension-badge-controller';

// Served by rpc.discover; generated from the same registry used for validation.
const openRpcDocument = generateOpenRpcDocument();

// Pending requests expire after this long, and at most this many are retained, so that
// unapproved requests cannot accumulate indefinitely.
const maxPendingRequests = 10;

// A denied extension may not re-request approval for this long. Session storage is used so
// that cooldowns survive service worker restarts but reset with each browser session.
export const deniedRequestCooldownsKey = 'externalConnectionDeniedCooldowns';

const badgeReason = 'externalConnections';

class ExternalRpcError extends Error {
    constructor(
        readonly code: number,
        message: string,
        readonly data?: unknown
    ) {
        super(message);
    }
}

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
    // onUpdated carries no oldValue, so track approved IDs across updates to detect additions/revocations.
    private _lastApprovedIds?: Set<string>;

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
            activePendingExternalConnections(externalConnections?.connections ?? {}, Date.now())
        ).length;
        this._badgeController.setGlobalAlert(badgeReason, pendingCount > 0);
        this._badgeController.setTabAlerts(
            pendingCount > 0 ? videoElements.map((videoElement) => videoElement.id) : []
        );
    }

    private _onConnectExternal(port: Browser.runtime.Port) {
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
            }
        });

        port.onMessage.addListener((message) => void this._onMessage(senderId, port, message));
    }

    private async _onMessage(senderId: string, port: Browser.runtime.Port, message: unknown) {
        const incoming = parseJsonRpcIncomingMessage(message);

        if (incoming === undefined) {
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

        if (incoming.id === undefined) {
            return;
        }

        if (error !== undefined) {
            this._post(port, {
                jsonrpc: '2.0',
                id: incoming.id,
                error: { code: error.code, message: error.message, data: error.data },
            });
            return;
        }

        this._post(port, { jsonrpc: '2.0', id: incoming.id, result });

        if (incoming.method === 'approval-state' && (result as { state?: string })?.state === 'denied') {
            port.disconnect();
        }
    }

    private async _rpc(senderId: string, method: string, params: unknown, id: string | undefined) {
        if (method === 'rpc.discover') {
            return openRpcDocument;
        }

        const methodDef = externalApiMethods[method];

        if (method?.startsWith('rpc.') || methodDef?.paramsSchema === undefined) {
            throw new ExternalRpcError(jsonRpcErrorCodes.methodNotFound, 'Method not found');
        }

        const parsed = methodDef.paramsSchema.safeParse(params ?? {});

        if (!parsed.success) {
            throw new ExternalRpcError(jsonRpcErrorCodes.invalidParams, 'Invalid params', parsed.error.issues);
        }

        switch (method) {
            case 'initialize':
                await this._initialize(senderId, parsed.data as { name?: string });
                return { state: (await this._approvedIds()).has(senderId) ? 'approved' : 'pending' };
            case 'approval-state': {
                if ((await this._approvedIds()).has(senderId)) {
                    return { state: 'approved' };
                }

                const { externalConnections } = await this._globalStateProvider.get(['externalConnections']);

                if (externalConnections?.connections?.[senderId]?.deniedAt !== undefined) {
                    return { state: 'denied' };
                }

                const pending = activePendingExternalConnections(externalConnections?.connections ?? {}, Date.now())[
                    senderId
                ];

                if (pending !== undefined) {
                    return { state: 'pending' };
                }

                return { state: 'denied' };
            }
            default: {
                if (!(await this._approvedIds()).has(senderId)) {
                    throw new ExternalRpcError(jsonRpcErrorCodes.notApproved, 'Not approved');
                }

                const response = await this._dispatcher.dispatchCommand({
                    command: method as ExternalCommand['command'],
                    messageId: id as string,
                    body: parsed.data as object,
                } as ExternalCommand);

                if (response === undefined) {
                    throw new ExternalRpcError(jsonRpcErrorCodes.methodNotFound, 'Method not found');
                }

                return response.body;
            }
        }
    }

    private async _initialize(senderId: string, params: { name?: string }) {
        const name = params.name !== undefined && params.name.length > 0 ? params.name : undefined;
        await mutateExternalConnections(this._globalStateProvider, (externalConnections) => {
            const connection = externalConnections.connections[senderId];
            const now = Date.now();
            if (connection !== undefined) {
                if (connection.approvedAt !== undefined) {
                    if (connection.name === name) {
                        return false;
                    }

                    externalConnections.connections[senderId] = { ...connection, name };
                    return true;
                }

                if (connection.deniedAt !== undefined && now - connection.deniedAt < deniedRequestCooldownMs) {
                    return false;
                }
            }

            externalConnections.connections = this._pruneConnections(
                {
                    ...externalConnections.connections,
                    [senderId]: { name, requestedAt: now },
                },
                now
            );
            return true;
        });

        if (!(await this._approvedIds()).has(senderId)) {
            void this.updateBadge();
        }
    }

    private async _onExternalConnectionsUpdated(externalConnections: ExternalConnectionsState) {
        const newApproved = new Set(Object.keys(approvedExternalConnections(externalConnections.connections)));

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
        if (this._pendingRequestsNeedPrune(externalConnections.connections, Date.now())) {
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
            try {
                port.disconnect();
            } catch {
                // Expected if the port disconnects concurrently.
            }
        }
    }

    private _pendingRequestsNeedPrune(connections: ExternalConnectionsState['connections'], now: number): boolean {
        return Object.keys(this._pruneConnections(connections, now)).length < Object.keys(connections).length;
    }

    private async _prunePendingRequests(): Promise<void> {
        await mutateExternalConnections(this._globalStateProvider, (externalConnections) => {
            const pruned = this._pruneConnections(externalConnections.connections, Date.now());

            if (Object.keys(pruned).length === Object.keys(externalConnections.connections).length) {
                return false;
            }

            externalConnections.connections = pruned;
            return true;
        });
    }

    private _seedLastApprovedIds(externalConnections: ExternalConnectionsState) {
        if (this._lastApprovedIds !== undefined) {
            // An update already initialized the baseline from newer state.
            return;
        }

        this._lastApprovedIds = new Set(Object.keys(approvedExternalConnections(externalConnections.connections)));
    }

    private _pruneConnections(
        connections: ExternalConnectionsState['connections'],
        now: number
    ): ExternalConnectionsState['connections'] {
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

    private async _approvedIds(): Promise<Set<string>> {
        const { externalConnections } = await this._globalStateProvider.get(['externalConnections']);
        return new Set(Object.keys(approvedExternalConnections(externalConnections.connections)));
    }

    private _post(port: Browser.runtime.Port, message: unknown) {
        try {
            port.postMessage(message);
        } catch {
            // The port may disconnect concurrently while posting; expected teardown, not an error.
        }
    }
}
