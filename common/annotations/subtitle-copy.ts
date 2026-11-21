const copyScopes = new WeakMap<Element, string | null>();

/** Register a cue itself, or a container with a selector for its cues. */
export const registerSubtitleCopyScope = (element: HTMLElement | null, cueSelector: string | null = null) => {
    if (element) copyScopes.set(element, cueSelector);
};

const subtitleCueFor = (element: Element) => {
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        const selector = copyScopes.get(ancestor);
        if (selector === undefined) continue;
        if (selector === null) return ancestor;
        const cue = element.closest(selector);
        if (cue && ancestor.contains(cue)) return cue;
        return;
    }
};

type Fragment = Text | HTMLBRElement;

function* textFragments(node: Node, range: Range, skipElement: (node: Element) => boolean): Generator<Fragment> {
    if (!range.intersectsNode(node)) return;
    if (node instanceof Text) {
        yield node;
        return;
    }
    if (node instanceof Element && skipElement(node)) return;
    if (node instanceof HTMLBRElement) {
        yield node;
        return;
    }
    for (const child of node.childNodes) yield* textFragments(child, range, skipElement);
}

export const selectedSubtitleText = (document: Document, selection: AbstractRange) => {
    const view = document.defaultView;
    if (!view) return;
    const { startContainer, startOffset, endContainer, endOffset } = selection;
    const root = startContainer.getRootNode();
    if (
        selection.collapsed ||
        !startContainer.isConnected ||
        root !== endContainer.getRootNode() ||
        (root !== document && !(root instanceof ShadowRoot))
    ) {
        return;
    }

    const range = document.createRange();
    range.setStart(startContainer, startOffset);
    range.setEnd(endContainer, endOffset);
    if (range.collapsed) return;

    const ancestor = range.commonAncestorContainer;
    for (let parent = ancestor.parentElement; parent; parent = parent.parentElement) {
        if (view.getComputedStyle(parent).display === 'none') return;
    }

    // Never override a range if part of the composed tree cannot be inspected.
    let crossesShadowBoundary = false;
    const skipElement = (element: Element) => {
        if (view.getComputedStyle(element).display === 'none') return true;
        if (!element.shadowRoot && !element.matches('slot, iframe')) return false;
        crossesShadowBoundary = true;
        return true;
    };

    const parts: string[] = [];
    let previousCue: Element | undefined;
    for (const fragment of textFragments(ancestor, range, skipElement)) {
        const element = fragment instanceof Text ? fragment.parentElement : fragment;
        if (!element || ['hidden', 'collapse'].includes(view.getComputedStyle(element).visibility)) continue;
        const text = fragment instanceof Text ? fragment.data : '\n';
        const start = fragment === startContainer ? startOffset : 0;
        const end = fragment === endContainer ? endOffset : text.length;
        if (start >= end) continue;

        const cue = subtitleCueFor(element);
        if (!cue) {
            if (fragment instanceof HTMLBRElement) continue; // Structural separators between cues.
            return; // A selection containing non-subtitle text belongs to the browser.
        }
        if (element.closest('rt, rp')) continue;
        if (previousCue && previousCue !== cue) parts.push('\n');
        parts.push(text.slice(start, end));
        previousCue = cue;
    }
    const text = parts.join('');
    if (!crossesShadowBoundary && text.trim()) return text;
};
