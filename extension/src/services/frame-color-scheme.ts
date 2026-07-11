export const frameColorSchemeClass = () => {
    // Prevent iframe from showing up with solid background by selecting suitable color scheme according to document's color scheme
    // https://fvsch.com/transparent-iframes

    const documentColorSchemeMetaTag = document.querySelector('meta[name="color-scheme"]');

    if (documentColorSchemeMetaTag === null) {
        return 'asbplayer-color-scheme-normal';
    }

    const documentColorScheme = (documentColorSchemeMetaTag as HTMLMetaElement).content;
    const light = documentColorScheme.includes('light');
    const dark = documentColorScheme.includes('dark');

    if (light && dark) {
        return 'asbplayer-color-scheme-light-dark';
    }

    if (light) {
        return 'asbplayer-color-scheme-light';
    }

    if (dark) {
        return 'asbplayer-color-scheme-dark';
    }

    return 'asbplayer-color-scheme-normal';
};
