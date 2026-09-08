export default class InterpolatedContentClock {
    private anchorTimestampMs = 0;
    private anchorAtMs = 0;
    private rate = 1;
    private advancing = false;
    private anchored = false;

    get hasAnchor(): boolean {
        return this.anchored;
    }

    reset(): void {
        this.anchorTimestampMs = 0;
        this.anchorAtMs = 0;
        this.rate = 1;
        this.advancing = false;
        this.anchored = false;
    }

    timeAt(nowMs: number): number {
        if (!this.advancing) return this.anchorTimestampMs;
        return this.anchorTimestampMs + (nowMs - this.anchorAtMs) * this.rate;
    }

    updateAnchor(timestampMs: number, nowMs: number): void {
        this.anchorTimestampMs = timestampMs;
        this.anchorAtMs = nowMs;
        this.anchored = true;
    }

    updateRate(rate: number, nowMs: number): void {
        this.updateAnchor(this.timeAt(nowMs), nowMs);
        this.rate = rate;
    }

    updateAdvancing(advancing: boolean, nowMs: number): void {
        this.updateAnchor(this.timeAt(nowMs), nowMs);
        this.advancing = advancing;
    }
}
