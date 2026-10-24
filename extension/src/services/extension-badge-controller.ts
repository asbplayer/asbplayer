/**
 * Composes contributions to the extension action's badge. The badge is a single global slot with
 * last-write-wins semantics, so independent writers register named global alerts instead of
 * clobbering each other.
 */
export class ExtensionBadgeController {
    private readonly _action: BadgeAction;
    private readonly _globalAlerts = new Set<string>();
    private _tabIds: number[] = [];

    constructor(action: BadgeAction) {
        this._action = action;
    }

    setGlobalAlert(reason: string, alerting: boolean) {
        if (alerting) {
            this._globalAlerts.add(reason);
        } else {
            this._globalAlerts.delete(reason);
        }

        this._action.setBadgeText({ text: this._globalAlerts.size > 0 ? '!' : '' });
    }

    /** Sets a '!' badge on the given tabs and clears it from tabs badged previously. */
    setTabAlerts(tabIds: number[]) {
        const badgedTabIds = new Set(tabIds);

        for (const tabId of new Set([...this._tabIds, ...badgedTabIds])) {
            this._action.setBadgeText({ tabId, text: badgedTabIds.has(tabId) ? '!' : '' });
        }

        this._tabIds = [...badgedTabIds];
    }
}

export interface BadgeAction {
    setBadgeText(details: { text?: string; tabId?: number }): unknown;
}
