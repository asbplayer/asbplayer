import { asbError } from '@project/common/util/log';
import type { ExternalConnectionsState, GlobalStateProvider } from '@project/common/global-state';
import type { ExternalApprovalMessage, ExternalCommand, ExternalHelloMessage } from '@project/common/external-commands';
import { ExternalCommandDispatcher } from '@project/common/external-commands/dispatcher';
import { externalCommandHandlers } from '@project/extension/src/services/external-command-handlers';
import type { SettingsProvider } from '@project/common/settings';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import type { ExtensionBadgeController } from '@project/extension/src/services/extension-badge-controller';

// Pending requests expire after this long, and at most this many are retained, so that
// unapproved requests cannot accumulate indefinitely.
const pendingRequestExpirationMs = 24 * 60 * 60 * 1000;
const maxPendingRequests = 10;

const helloType: ExternalHelloMessage['type'] = 'asbplayer-external-hello';

const badgeReason = 'externalConnections';

/**
 * Manages external browser extensions connecting over `browser.runtime.onConnectExternal`.
 *
 * Approval is keyed on the connecting extension's runtime ID and persisted in the
 * `externalConnections` global state key. Surfaces (popup, options page, or the asbplayer app)
 * manage approvals by writing global state; this coordinator only reacts to those writes.
 *
 * The port protocol is the external command wire format shared with the WebSocket server
 * integration, plus:
 * - `{type: 'asbplayer-external-hello', name?, version?}` sent by the external extension on connect
 * - `{type: 'asbplayer-external-approval', approved}` sent whenever the approval state changes
 *
 * Frames from unapproved extensions are dropped, not queued. Pending requests are recorded on
 * hello so the user can be alerted via badges.
 */
export class ExternalConnectionCoordinator {
    private readonly _globalStateProvider: GlobalStateProvider;
    private readonly _tabRegistry: TabRegistry;
    private readonly _badgeController: ExtensionBadgeController;
    private readonly _dispatcher: ExternalCommandDispatcher;
    private readonly _ports = new Map<string, Set<Browser.runtime.Port>>();
    // onUpdated carries no oldValue, so track approved IDs across updates to detect
    // additions/revocations.
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

        const pendingCount = Object.values(externalConnections?.pending ?? []).length;
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

        void this._postApproval(port);
        port.onMessage.addListener((message) => void this._onMessage(senderId, port, message));
    }

    private async _onMessage(senderId: string, port: Browser.runtime.Port, message: unknown) {
        if (typeof message === 'object' && message !== null && (message as { type?: unknown }).type === helloType) {
            await this._hello(senderId, message as ExternalHelloMessage);
            await this._postApproval(port);
            return;
        }

        const command = message as ExternalCommand | undefined;

        if (typeof command?.command !== 'string' || typeof command?.messageId !== 'string') {
            return;
        }

        if (!(await this._approvedIds()).has(senderId)) {
            return;
        }

        let response;

        try {
            response = await this._dispatcher.dispatchCommand(command);
        } catch (error) {
            asbError('external-connection', 'Failed to dispatch external command:', error);
            response = {
                command: 'response' as const,
                messageId: command.messageId,
                body: { error: error instanceof Error ? error.message : String(error) },
            };
        }

        if (response !== undefined) {
            this._post(port, response);
        }
    }

    private async _hello(senderId: string, message: ExternalHelloMessage) {
        const name = typeof message.name === 'string' && message.name.length > 0 ? message.name : undefined;

        await this._mutateExternalConnections((externalConnections) => {
            const approved = externalConnections.approved[senderId];

            if (approved !== undefined) {
                if (approved.name === name) {
                    return false;
                }

                externalConnections.approved[senderId] = { ...approved, name };
                return true;
            }

            const now = Date.now();
            externalConnections.pending = this._prunePending(
                {
                    ...externalConnections.pending,
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
        const newApproved = new Set(Object.keys(externalConnections.approved ?? {}));

        if (this._lastApprovedIds === undefined) {
            // The baseline fetch has not resolved yet.
            this._lastApprovedIds = new Set();
        }

        const oldApproved = this._lastApprovedIds;

        for (const extensionId of newApproved) {
            if (!oldApproved.has(extensionId)) {
                this._postApprovalToPorts(extensionId, true);
            }
        }

        for (const extensionId of oldApproved) {
            if (!newApproved.has(extensionId)) {
                this._postApprovalToPorts(extensionId, false);
            }
        }

        this._lastApprovedIds = newApproved;

        // Prune expired/capped pending requests left behind by other writers of global state.
        if (this._pendingRequestsNeedPrune(externalConnections.pending, Date.now())) {
            await this._prunePendingRequests();
        }

        await this.updateBadge();
    }

    private _pendingRequestsNeedPrune(pending: ExternalConnectionsState['pending'], now: number): boolean {
        return Object.keys(this._prunePending(pending, now)).length < Object.keys(pending).length;
    }

    private async _prunePendingRequests(): Promise<void> {
        await this._mutateExternalConnections((externalConnections) => {
            const pruned = this._prunePending(externalConnections.pending, Date.now());

            if (Object.keys(pruned).length === Object.keys(externalConnections.pending).length) {
                return false;
            }

            externalConnections.pending = pruned;
            return true;
        });
    }

    private _seedLastApprovedIds(externalConnections: ExternalConnectionsState) {
        if (this._lastApprovedIds !== undefined) {
            // An update already initialized the baseline from newer state.
            return;
        }

        this._lastApprovedIds = new Set(Object.keys(externalConnections.approved ?? {}));
    }

    private _prunePending(
        pending: ExternalConnectionsState['pending'],
        now: number
    ): ExternalConnectionsState['pending'] {
        return Object.fromEntries(
            Object.entries(pending)
                .filter(([, request]) => now - (request?.requestedAt ?? 0) <= pendingRequestExpirationMs)
                .sort(([, a], [, b]) => (b?.requestedAt ?? 0) - (a?.requestedAt ?? 0))
                .slice(0, maxPendingRequests)
        );
    }

    private async _mutateExternalConnections(
        mutate: (externalConnections: ExternalConnectionsState) => boolean
    ): Promise<void> {
        const state = await this._globalStateProvider.get(['externalConnections']);
        const externalConnections: ExternalConnectionsState = JSON.parse(JSON.stringify(state.externalConnections));

        if (!mutate(externalConnections)) {
            return;
        }

        await this._globalStateProvider.set({ externalConnections });
    }

    private async _approvedIds(): Promise<Set<string>> {
        const { externalConnections } = await this._globalStateProvider.get(['externalConnections']);
        return new Set(Object.keys(externalConnections?.approved ?? {}));
    }

    private async _postApproval(port: Browser.runtime.Port) {
        const senderId = port.sender?.id;
        const approved = senderId !== undefined && (await this._approvedIds()).has(senderId);
        const message: ExternalApprovalMessage = { type: 'asbplayer-external-approval', approved };
        this._post(port, message);
    }

    private _postApprovalToPorts(extensionId: string, approved: boolean) {
        const message: ExternalApprovalMessage = { type: 'asbplayer-external-approval', approved };

        for (const port of this._ports.get(extensionId) ?? []) {
            this._post(port, message);
        }
    }

    private _post(port: Browser.runtime.Port, message: unknown) {
        try {
            port.postMessage(message);
        } catch {
            // The port may disconnect concurrently while posting; expected teardown, not an error.
        }
    }
}
