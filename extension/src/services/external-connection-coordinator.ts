import { asbError } from '@project/common/util/log';
import type { ExternalConnectionsState, GlobalStateProvider } from '@project/common/global-state';
import type { ExternalApprovalMessage, ExternalCommand, ExternalHelloMessage } from '@project/common/external-commands';
import { ExternalCommandDispatcher } from '@project/common/external-commands/dispatcher';
import { externalCommandHandlers } from '@project/extension/src/services/external-command-handlers';
import type { SettingsProvider } from '@project/common/settings';
import type TabRegistry from '@project/extension/src/services/tab-registry';
import type { ExtensionBadgeController } from '@project/extension/src/services/extension-badge-controller';

// Pending connection requests are dropped after this long and at most this many are retained,
// so that unapproved requests cannot accumulate indefinitely in global state.
const pendingRequestExpirationMs = 24 * 60 * 60 * 1000;
const maxPendingRequests = 10;

const helloType: ExternalHelloMessage['type'] = 'asbplayer-external-hello';

const badgeReason = 'externalConnections';

/**
 * Manages sibling browser extensions connecting over `browser.runtime.onConnectExternal`.
 *
 * Approval is keyed on the connecting extension's runtime ID and persisted in global state
 * (`externalConnections`). Any surface (popup, options page, or the asbplayer app) manages
 * approvals by writing global state; this coordinator only reacts to those writes.
 *
 * The port protocol is the external command wire format shared with the WebSocket server
 * integration: raw `ExternalCommand` frames are dispatched and answered with
 * `{command: 'response', messageId, body}` frames. Additionally:
 * - `{type: 'asbplayer-external-hello', name?, version?}` is sent by the sibling on connect and
 *   answered with an approval frame reflecting the current approval state.
 * - `{type: 'asbplayer-external-approval', approved}` is also posted whenever the approval
 *   state changes while the port is open.
 * Frames from unapproved extensions are dropped, not queued. Pending requests are recorded on
 * hello so the user can be alerted via badges.
 */
export class ExternalConnectionCoordinator {
    private readonly _globalStateProvider: GlobalStateProvider;
    private readonly _tabRegistry: TabRegistry;
    private readonly _settings: SettingsProvider;
    private readonly _badgeController: ExtensionBadgeController;
    private readonly _dispatcher: ExternalCommandDispatcher;
    private readonly _ports = new Map<string, Set<Browser.runtime.Port>>();

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
        this._settings = settings;
        this._badgeController = badgeController;
        this._dispatcher = dispatcher ?? new ExternalCommandDispatcher();

        if (dispatcher === undefined) {
            this._dispatcher.setHandlers(externalCommandHandlers(settings, tabRegistry));
        }

        browser.runtime.onConnectExternal.addListener((port) => this._onConnectExternal(port));
        browser.storage.local.onChanged.addListener((changes) => {
            const change = changes['externalConnections'];

            if (change !== undefined) {
                void this._onExternalConnectionsChanged(
                    change.oldValue as ExternalConnectionsState | undefined,
                    change.newValue as ExternalConnectionsState | undefined
                );
            }
        });
    }

    /** Recomputes this feature's badge contributions from global state. */
    async updateBadge(): Promise<void> {
        const [{ externalConnections }, videoElements] = await Promise.all([
            this._globalStateProvider.get(['externalConnections']),
            this._tabRegistry.activeVideoElements(),
        ]);

        const pendingCount = Object.keys(externalConnections?.pending ?? {}).length;
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

    private async _onExternalConnectionsChanged(
        oldValue: ExternalConnectionsState | undefined,
        newValue: ExternalConnectionsState | undefined
    ) {
        const oldApproved = new Set(Object.keys(oldValue?.approved ?? {}));
        const newApproved = new Set(Object.keys(newValue?.approved ?? {}));

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

        // Prune expired/capped pending requests left behind by other writers of global state.
        await this._mutateExternalConnections((externalConnections) => {
            const pruned = this._prunePending(externalConnections.pending, Date.now());

            if (Object.keys(pruned).length === Object.keys(externalConnections.pending).length) {
                return false;
            }

            externalConnections.pending = pruned;
            return true;
        });
        await this.updateBadge();
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
            // The port may disconnect concurrently, e.g. when the sibling closes it. Posting
            // to a disconnected port throws, which is expected teardown rather than an error
            // worth logging.
        }
    }
}
