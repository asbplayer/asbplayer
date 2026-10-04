// For some reason WXT won't include this as a second script element under <head>,
// so we are resorting to directly including this code from the public folder.
//
// It's important for it to appear in <head> so that it runs before containing iframe
// renders, preventing background color flickering.

const params = new URLSearchParams(window.location.search);
const colorScheme = params.get('colorScheme');

if (colorScheme === 'normal' || colorScheme === 'light' || colorScheme === 'dark') {
    document.documentElement.style.setProperty('color-scheme', colorScheme, 'important');
} else if (colorScheme === 'light dark') {
    document.documentElement.style.setProperty('color-scheme', 'light dark', 'important');
}
