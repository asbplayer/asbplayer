export function getLocale(language: string): Intl.Locale | undefined {
    try {
        return new Intl.Locale(language.trim().replace(/_/g, '-'));
    } catch {
        return;
    }
}

export function canonicalLanguageTag(language: Intl.Locale): string;
export function canonicalLanguageTag(language: string): string | undefined;
export function canonicalLanguageTag(language: string | Intl.Locale): string | undefined {
    const locale = typeof language === 'string' ? getLocale(language) : language;
    return locale?.baseName; // baseName normalizes for Intl.DisplayNames
}

function capitalizeFirstLetter(value: string, locale: string): string {
    const firstCodePoint = value.codePointAt(0);
    if (firstCodePoint === undefined) return value;
    const firstCharacter = String.fromCodePoint(firstCodePoint);
    return firstCharacter.toLocaleUpperCase(locale) + value.slice(firstCharacter.length);
}

export function languageDisplayName(language: string, locale: Intl.Locale | undefined = getLocale(language)): string {
    const canonical = canonicalLanguageTag(language);
    if (canonical === undefined || locale === undefined) return language;

    try {
        const displayLocale = canonicalLanguageTag(locale);
        const displayName = new Intl.DisplayNames([displayLocale], {
            type: 'language',
            languageDisplay: 'standard',
            fallback: 'none',
        }).of(canonical);
        return displayName === undefined ? language : capitalizeFirstLetter(displayName, displayLocale);
    } catch {
        return language;
    }
}

const regexSpecialCharacters = /[.*+?^${}()|[\]\\]/g;
const nonLanguageSubtitleLabels = new Set(['SDH', 'HI', 'OC', 'VI', 'ALT', 'FAN']);

/** Matches a localized language name inside a subtitle label so it can be detected or replaced literally. */
function caseInsensitivePattern(value: string) {
    return new RegExp(value.replace(regexSpecialCharacters, '\\$&'), 'iu');
}

function isNonLanguageSubtitleLabel(label: string) {
    return nonLanguageSubtitleLabels.has(label.toUpperCase());
}

function combineLanguageDisplayAndLabel(languageDisplay: string, label: string, languageInLabel?: RegExp) {
    const detail = languageInLabel ? label.replace(languageInLabel, '').trim() : label;
    return detail ? `${languageDisplay} · ${detail}` : languageDisplay;
}

function localizedLanguagePatterns(locale: Intl.Locale): readonly RegExp[] {
    const displayLocales = new Map<string, Intl.Locale>();
    for (const displayLanguage of [locale.baseName, 'en', ...navigator.languages]) {
        const displayLocale = getLocale(displayLanguage);
        if (displayLocale) displayLocales.set(displayLocale.baseName, displayLocale);
    }

    const languageTags = new Set([locale.baseName, locale.language]);
    const names = new Set<string>();

    for (const displayLocale of displayLocales.values()) {
        for (const languageTag of languageTags) {
            names.add(languageDisplayName(languageTag, displayLocale));
        }
    }

    return [...names].sort((a, b) => b.length - a.length).map(caseInsensitivePattern);
}

/**
 * Generates a display label for a subtitle track by combining the language display name and the parsed label.
 * See the test cases for examples of how labels are combined with language display names.
 */
export function genericSubtitleDisplayLabel(
    parsedLabel: string | undefined,
    language: string | undefined,
    fallback: string
): string {
    const label = parsedLabel?.trim();
    const normalizedLanguage = language?.trim();

    const locale = normalizedLanguage ? getLocale(normalizedLanguage) : undefined;
    const languageDisplay = normalizedLanguage ? languageDisplayName(normalizedLanguage, locale) : undefined;
    const languageResolved = languageDisplay !== undefined && languageDisplay !== normalizedLanguage;

    if (label && normalizedLanguage) {
        if (!languageResolved) return `${label} · ${normalizedLanguage}`;

        const labelLocale = isNonLanguageSubtitleLabel(label) ? undefined : getLocale(label);
        const canonicalLabel = labelLocale ? canonicalLanguageTag(labelLocale) : undefined;
        if (
            locale &&
            canonicalLabel &&
            (canonicalLabel === canonicalLanguageTag(locale) || canonicalLabel === locale.language)
        ) {
            return languageDisplay;
        }

        if (locale) {
            const languageInLabel = localizedLanguagePatterns(locale).find((pattern) => pattern.test(label));
            if (languageInLabel) return combineLanguageDisplayAndLabel(languageDisplay, label, languageInLabel);
        }

        return combineLanguageDisplayAndLabel(languageDisplay, label);
    }

    if (label) {
        if (isNonLanguageSubtitleLabel(label)) return label;
        const labelDisplay = languageDisplayName(label);
        return labelDisplay !== label ? labelDisplay : label;
    }
    if (languageResolved) return languageDisplay;
    if (normalizedLanguage) return fallback ? `${fallback} · ${normalizedLanguage}` : normalizedLanguage;
    return fallback;
}
