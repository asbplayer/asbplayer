export const frameColorScheme = () => {
    // Prevent iframe from showing up with solid background by selecting suitable color scheme according to document's color scheme
    // https://fvsch.com/transparent-iframes

    const documentColorSchemeMetaTag = document.querySelector('meta[name="color-scheme"]');
    const documentColorScheme =
        documentColorSchemeMetaTag === null
            ? getComputedStyle(document.documentElement).colorScheme
            : (documentColorSchemeMetaTag as HTMLMetaElement).content;
    const light = documentColorScheme.includes('light');
    const dark = documentColorScheme.includes('dark');

    if (light && dark) {
        return 'none';
    }

    if (light) {
        return 'light';
    }

    if (dark) {
        return 'dark';
    }

    return 'normal';
};

export const frameColorSchemeClass = () => {
    const colorScheme = frameColorScheme();

    switch (colorScheme) {
        case 'none':
            return 'asbplayer-color-scheme-light-dark';
        case 'light':
            return 'asbplayer-color-scheme-light';
        case 'dark':
            return 'asbplayer-color-scheme-dark';
        default:
            return 'asbplayer-color-scheme-normal';
    }
};
