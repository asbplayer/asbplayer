// Jimaku episode-number detection patterns.
//
// Strict whitelist only: a pattern must unambiguously denote an episode
// number. Bare-number patterns are intentionally excluded — titles that
// themselves contain digits (e.g. "2.43 ...") would otherwise yield false
// positives, and a wrong episode sent to the Jimaku files API filters the
// result down to empty, which makes it look like no subtitles exist at all.
//
// Patterns are tried in order; the first match wins. Each pattern's first
// capture group is the episode number, parsed via its paired `parse` hook
// (numeric capture groups use `parseNumeric`, CJK kanji numerals use
// `parseKanji`).
//
// This list is kept small and conservative on purpose. Add new patterns
// only when they are unambiguous, and group them under the matching
// language/format section below with a short comment so the file stays
// easy to extend via community contribution.

interface EpisodePattern {
    regex: RegExp;
    parse: (capture: string) => number | undefined;
}

const parseNumeric = (capture: string): number | undefined => {
    const episode = Number(capture);
    return Number.isFinite(episode) && episode > 0 ? episode : undefined;
};

// CJK kanji numerals, shared by Chinese and Japanese (一..九, 十).
// Supports 1-99, which covers realistic episode counts; hundreds are
// not handled since they are vanishingly rare for episodic subtitles.
const KANJI_DIGITS: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
};

const parseKanji = (capture: string): number | undefined => {
    if (capture.length === 0) {
        return undefined;
    }

    // Single digit, no tens: 一..九
    if (!capture.includes('十')) {
        return KANJI_DIGITS[capture];
    }

    // Contains 十: forms are 十 (10), 十X (11-19), X十 (20,30..90), X十X (21-99).
    // More than one 十 is invalid.
    const parts = capture.split('十');
    if (parts.length !== 2) {
        return undefined;
    }

    const [left, right] = parts;
    const tens = left.length > 0 ? KANJI_DIGITS[left] : 1;
    const ones = right.length > 0 ? KANJI_DIGITS[right] : 0;
    if (tens === undefined || ones === undefined) {
        return undefined;
    }

    return tens * 10 + ones;
};

export const EPISODE_PATTERNS: EpisodePattern[] = [
    //=== English / SxxExx style (Netflix, Amazon, ...)
    //   Tolerates an optional separator between season and episode
    //   ("S01E05", "S01.E05").
    { regex: /S\d{1,2}\.?E(\d{1,3})\b/i, parse: parseNumeric },
    //=== English / explicit episode prefix ("EP05", "E05")
    { regex: /\bEP?(\d{1,3})\b/i, parse: parseNumeric },
    //=== CJK / 第N集·话 (Chinese) · 第N話 (Japanese), arabic numerals
    { regex: /第(\d{1,3})[话集話]/, parse: parseNumeric },
    //=== CJK / 第N集·话 (Chinese "第十一集") · 第N話 (Japanese "第十一話"),
    //       kanji numerals — shared 中/日 coverage.
    { regex: /第([一二三四五六七八九十]+)[话集話]/, parse: parseKanji },
];

// Extracts the current episode number from a page-script basename hint.
// Returns undefined when no whitelisted pattern matches, in which case
// callers should fall back to requesting all files (no episode filter).
export const extractEpisode = (hint?: string): number | undefined => {
    const trimmed = hint?.trim() ?? '';
    if (trimmed.length === 0) {
        return undefined;
    }

    for (const { regex, parse } of EPISODE_PATTERNS) {
        const match = regex.exec(trimmed);
        if (match?.[1] === undefined) {
            continue;
        }
        const episode = parse(match[1]);
        if (episode !== undefined) {
            return episode;
        }
    }

    return undefined;
};
