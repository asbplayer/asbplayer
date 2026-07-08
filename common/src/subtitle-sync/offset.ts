import type { SubtitleModel } from '../model';

/** Timeline resolution. Coarse enough that a full episode scores in milliseconds. */
const FRAME_MS = 100;
/** Largest offset (in either direction) the search will consider. */
const MAX_OFFSET_MS = 120_000;
/** Tracks with fewer active frames than this fraction can't be correlated reliably (signs/songs). */
const MIN_DENSITY = 0.1;

export interface SubtitleSyncResult {
    /** Milliseconds to add to the primary track's cue timings so it aligns to the reference. */
    offset: number;
    /** Jaccard overlap of the best alignment, in [0, 1]. */
    confidence: number;
}

type Cue = Pick<SubtitleModel, 'originalStart' | 'originalEnd'>;

/** Binary timeline where a frame is true when any cue is active during it. */
function buildTimeline(cues: Cue[], durationMs: number): boolean[] {
    const timeline = new Array<boolean>(Math.ceil(durationMs / FRAME_MS)).fill(false);

    for (const { originalStart, originalEnd } of cues) {
        const startFrame = Math.floor(originalStart / FRAME_MS);
        const endFrame = Math.min(Math.ceil(originalEnd / FRAME_MS), timeline.length);

        for (let i = startFrame; i < endFrame; i++) {
            timeline[i] = true;
        }
    }

    return timeline;
}

const activeFrames = (timeline: boolean[]) => timeline.reduce((count, active) => count + (active ? 1 : 0), 0);

/**
 * Detect the constant offset (ms) to add to a primary subtitle track so its cue timing aligns to a
 * reference track. Compares timing only, so it is language-agnostic. The returned offset matches the
 * player's convention (added to a cue's original timing), so it can be handed straight to the offset
 * handler. Confidence is the Jaccard overlap of the best alignment; callers decide how to treat a low
 * value. Returns zero confidence when alignment is not meaningful (empty or too-sparse tracks).
 */
export function detectSubtitleOffset(primary: Cue[], reference: Cue[]): SubtitleSyncResult {
    if (primary.length === 0 || reference.length === 0) {
        return { offset: 0, confidence: 0 };
    }

    const maxEnd = (cues: Cue[]) => cues.reduce((max, c) => Math.max(max, c.originalEnd), 0);
    const span = Math.max(maxEnd(primary), maxEnd(reference));

    if (!isFinite(span) || span <= 0) {
        return { offset: 0, confidence: 0 };
    }

    const primaryTimeline = buildTimeline(primary, span);
    const referenceTimeline = buildTimeline(reference, span);
    const frameCount = primaryTimeline.length;
    const primaryActiveTotal = activeFrames(primaryTimeline);
    const referenceActiveTotal = activeFrames(referenceTimeline);

    if (primaryActiveTotal / frameCount < MIN_DENSITY || referenceActiveTotal / frameCount < MIN_DENSITY) {
        return { offset: 0, confidence: 0 };
    }

    const maxLag = Math.min(Math.ceil(MAX_OFFSET_MS / FRAME_MS), frameCount - 1);
    // Without this, a coincidental one-frame overlap at an extreme lag scores a perfect Jaccard of 1.
    const minOverlap = Math.max(3, Math.floor(0.2 * Math.min(primaryActiveTotal, referenceActiveTotal)));

    let bestLag = 0;
    let bestScore = 0;

    // Positive lag => reference is later than the primary, so the primary shifts forward to match.
    for (let lag = -maxLag; lag <= maxLag; lag++) {
        let both = 0;
        let primaryActive = 0;
        let referenceActive = 0;

        for (let i = Math.max(0, -lag); i < Math.min(frameCount, frameCount - lag); i++) {
            const p = primaryTimeline[i];
            const r = referenceTimeline[i + lag];
            if (p) primaryActive++;
            if (r) referenceActive++;
            if (p && r) both++;
        }

        if (both < minOverlap) {
            continue;
        }

        const score = both / (primaryActive + referenceActive - both);
        if (score > bestScore || (score === bestScore && Math.abs(lag) < Math.abs(bestLag))) {
            bestScore = score;
            bestLag = lag;
        }
    }

    return { offset: bestLag * FRAME_MS, confidence: bestScore };
}
