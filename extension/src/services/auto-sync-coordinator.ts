export interface AutoSyncClaim {
    readonly video: HTMLMediaElement;
}

export default class AutoSyncCoordinator {
    private preferredVideo?: HTMLMediaElement;
    private claim?: AutoSyncClaim;

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
        if (
            this.claim !== undefined &&
            (!candidates.includes(this.claim.video) ||
                (preferredVideo !== undefined && preferredVideo !== this.claim.video))
        ) {
            const revokedClaim = this.claim;
            this.claim = undefined;
            this.preferredVideo = preferredVideo;
            return revokedClaim;
        }

        if (this.claim === undefined) this.preferredVideo = preferredVideo;
        return;
    }

    /**
     * Clears the current preference and claim, such as when the page location changes.
     *
     * @return The claim revoked by the reset, or undefined when there was no active claim.
     */
    reset(): AutoSyncClaim | undefined {
        const revokedClaim = this.claim;
        this.preferredVideo = undefined;
        this.claim = undefined;
        return revokedClaim;
    }

    tryClaim(video: HTMLMediaElement): AutoSyncClaim | undefined {
        if (this.claim !== undefined) return this.claim.video === video ? this.claim : undefined;
        if (this.preferredVideo !== video) return;
        const claim = { video };
        this.claim = claim;
        return claim;
    }

    isCurrent(claim: AutoSyncClaim | undefined): boolean {
        return claim === undefined || this.claim === claim;
    }
}
