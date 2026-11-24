import project from '@project/common/project';

export const docsUrl = (lang: string, path: string) =>
    lang === project.defaultLanguage
        ? `${project.urls.docs}/${path}`
        : // Docusaurus language codes use '-' instead of '_'
          `${project.urls.docs}/${lang.replace('_', '-')}/${path}`;

export function toAppLanguage(
    uiLanguage: string,
    supportedLanguages: readonly string[],
    defaultLanguage: string = project.defaultLanguage
): string {
    const candidates = [uiLanguage.replaceAll('-', '_'), uiLanguage.split('-')[0]];
    return candidates.find((code) => supportedLanguages.includes(code)) ?? defaultLanguage;
}
