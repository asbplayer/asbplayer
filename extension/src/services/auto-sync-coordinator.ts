const autoSyncPromotionTimeLimitMs = 5000;

export interface AutoSyncClaim {
    readonly video: HTMLMediaElement;
}

export default class AutoSyncCoordinator {
    private preferredVideo?: HTMLMediaElement;
    private claim?: AutoSyncClaim;
    private claimStartedAt?: number;
    private readonly now: () => number;

    constructor(now: () => number) {
        this.now = now;
    }

    /**
     * Reconciles the current candidates and preference with the active claim.
     *
     * @param candidates Videos currently eligible for auto-sync.
     * @param preferredVideo The highest-preference eligible video, or undefined when none is eligible.
     * @return The claim revoked by this reconciliation, or undefined when no claim was revoked.
     */
    reconcile(
        candidates: readonly HTMLMediaElement[],
        preferredVideo: HTMLMediaElement | undefined
    ): AutoSyncClaim | undefined {
        if (this.claim === undefined) {
            this.preferredVideo = preferredVideo;
            return;
        }
        if (!candidates.includes(this.claim.video)) return this.revokeClaim(preferredVideo);
        if (preferredVideo !== undefined && preferredVideo !== this.claim.video && this.isPromotionAllowed()) {
            return this.revokeClaim(preferredVideo);
        }
        return;
    }

    private isPromotionAllowed(): boolean {
        return this.claimStartedAt !== undefined && this.now() - this.claimStartedAt < autoSyncPromotionTimeLimitMs;
    }

    private revokeClaim(preferredVideo: HTMLMediaElement | undefined): AutoSyncClaim | undefined {
        const revokedClaim = this.claim;
        this.preferredVideo = preferredVideo;
        this.claim = undefined;
        this.claimStartedAt = undefined;
        return revokedClaim;
    }

    /**
     * Clears the current preference and claim, such as when the page location changes.
     *
     * @return The claim revoked by the reset, or undefined when there was no active claim.
     */
    reset(): AutoSyncClaim | undefined {
        return this.revokeClaim(undefined);
    }

    tryClaim(video: HTMLMediaElement): AutoSyncClaim | undefined {
        if (this.claim !== undefined) return this.claim.video === video ? this.claim : undefined;
        if (this.preferredVideo !== video) return;
        const claim = { video };
        this.claim = claim;
        this.claimStartedAt = this.now();
        return claim;
    }

    isCurrent(claim: AutoSyncClaim | undefined): boolean {
        return claim === undefined || this.claim === claim;
    }
}
