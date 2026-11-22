/**
 * Locale identifiers shared between the Docusaurus site (docs/) and the repo's
 * localization scripts. Everything derives from project.json's languages;
 * there are no hand-maintained per-language tables. If a future language
 * needs a case the derivations do not cover, extend these functions rather
 * than reintroducing constant maps.
 */

/** Docusaurus (BCP-47) locale for an app language code: the app writes region subtags with underscores, BCP-47 uses dashes. */
export function docsLocale(language: string): string {
    return language.replaceAll('_', '-');
}

/** All non-English Docusaurus locales for the configured app languages. */
export function docsLocales(languages: readonly { code: string }[]): string[] {
    return languages.filter((language) => language.code !== 'en').map((language) => docsLocale(language.code));
}

/**
 * Search language for @easyops-cn/docusaurus-search-local, which takes
 * lunr-languages codes: the locale's primary subtag (`pt-BR` -> `pt`,
 * `zh-CN` -> `zh`). A language lunr-languages does not ship fails the docs
 * build at require time, the earliest actionable point for adding an upstream
 * version or a patches/ registration (Indonesian arrived that way).
 */
export function searchLanguage(locale: string): string {
    return locale.split('-')[0]!;
}

/** Combined multi-language index, one entry per site locale plus English. */
export function searchLanguages(languages: readonly { code: string }[]): string[] {
    return ['en', ...docsLocales(languages).map(searchLanguage)];
}

/**
 * Native label for the locale dropdown, the same Intl.DisplayNames approach
 * the app's languageDisplayName uses. Lowercase autonyms like "español" and
 * parenthesized regions like "português (Brasil)" are ICU's native forms.
 */
export function localeLabel(locale: string): string {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(locale);
}
