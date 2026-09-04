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

// Detect episode and strip the matched marker from the title in one pass, so the
// search query stays clean for every supported format (SxxExx, EP, CJK episode markers).
export const prepareHint = (hint?: string): { episode: number | undefined; cleaned: string } => {
    const trimmed = hint?.trim() ?? '';
    if (trimmed.length === 0) {
        return { episode: undefined, cleaned: '' };
    }

    let episode: number | undefined;
    let stripped = trimmed;
    for (const { regex, parse } of EPISODE_PATTERNS) {
        const match = regex.exec(stripped);
        if (match?.[1] === undefined) {
            continue;
        }
        const parsed = parse(match[1]);
        if (parsed === undefined) {
            continue;
        }
        episode = parsed;
        stripped = stripped.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
        break;
    }

    const suffixSplit = stripped.split(' - ');
    const cleaned = suffixSplit.length > 1 ? suffixSplit[0].trim() : stripped;
    return { episode, cleaned };
};
