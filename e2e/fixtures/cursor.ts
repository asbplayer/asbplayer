/** Playwright's virtual mouse is invisible, so demo recordings get this element, which follows mousemove events. */
export function injectCursor() {
    const cursor = document.createElement('div');
    cursor.id = 'asb-e2e-cursor';
    cursor.style.cssText = 'position:fixed;left:-100px;top:-100px;z-index:2147483647;pointer-events:none;';
    cursor.innerHTML =
        '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M6 3l16 8.5-7 2-3.5 6.5z" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round"/></svg>';
    document.documentElement.append(cursor);

    addEventListener(
        'mousemove',
        (e) => {
            cursor.style.left = `${e.clientX - 5}px`;
            cursor.style.top = `${e.clientY - 3}px`;
        },
        true
    );
    addEventListener('mousedown', () => (cursor.style.opacity = '0.6'), true);
    addEventListener('mouseup', () => (cursor.style.opacity = '1'), true);
}
