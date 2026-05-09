export const frameColorScheme = () => {
    // Prevent iframe from showing up with solid background by selecting suitable color scheme according to document's color scheme
    // https://fvsch.com/transparent-iframes

    const documentColorSchemeMetaTag = document.querySelector('meta[name="color-scheme"]');

    if (documentColorSchemeMetaTag === null) {
        return 'normal';
    }

    const documentColorScheme = (documentColorSchemeMetaTag as HTMLMetaElement).content;
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
