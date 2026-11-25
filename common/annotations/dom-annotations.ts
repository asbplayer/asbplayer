import type { IndexedSubtitleModel } from '@project/common';
import { tokenAtLocation } from '@project/common/annotations/token-navigation';
import type { TokenSelectionLocation } from '@project/common/annotations/token-navigation';
import { asbTrace } from '@project/common/util/log';
import { selectedSubtitleText } from '@project/common/annotations/subtitle-copy';

export const ASB_TOKEN_CLASS = 'asb-token';
export const ASB_TOKEN_ADAPTIVE_HIDDEN_CLASS = 'asb-token-adaptive-hidden';
export const ASB_PLAYBACK_PAUSED_CLASS = 'asb-playback-paused';
export const ASB_TOKEN_HIGHLIGHT_CLASS = 'asb-token-highlight';
export const ASB_TOKEN_HOVER_CLASS = 'asb-token-hover';
export const ASB_TOKEN_HOVER_CUE_CLASS = 'asb-token-hover-cue';
export const ASB_TOKEN_HOVER_WORD_CLASS = 'asb-token-hover-word';
export const ASB_TOKEN_BASE_CLASS = 'asb-token-base';
export const ASB_TOKEN_ON_CUE_HOVER_CLASS = 'asb-token-on-cue-hover';
export const ASB_TOKEN_ON_WORD_HOVER_CLASS = 'asb-token-on-word-hover';
export const ASB_TOKEN_SELECTED_CLASS = 'asb-token-selected';
export const ASB_TOKEN_AUTO_PAUSE_SELECTED_CLASS = 'asb-token-auto-pause-selected';
const ASB_TOKEN_NATIVE_SELECTION_CLASS = 'asb-token-native-selection';
export const ASB_SUBTITLE_TOKEN_SELECTED_CLASS = 'asb-subtitle-token-selected';
export const ASB_SUBTITLE_INDEX_ATTRIBUTE = 'data-asb-subtitle-index';
export const ASB_TOKEN_START_ATTRIBUTE = 'data-asb-token-start';
export const ASB_READING_CLASS = 'asb-reading';
export const ASB_FREQUENCY_CLASS = 'asb-frequency';
export const ASB_GLOSS_CLASS = 'asb-gloss';
export const ASB_GLOSS_POPUP_CLASS = 'asb-gloss-popup';
export const ASB_GLOSS_TEXT_CLASS = 'asb-gloss-text';
export const ASB_GLOSS_UNDER_CLASS = 'asb-gloss-under';
export const ASB_PITCH_ACCENT_CLASS = 'asb-pitch-accent';
export const ASB_PITCH_ACCENT_MORA_CLASS = 'asb-pitch-accent-mora';
export const ASB_PITCH_ACCENT_MORA_HIGH_CLASS = 'asb-pitch-accent-mora-high';
export const ASB_PITCH_ACCENT_MORA_LOW_CLASS = 'asb-pitch-accent-mora-low';
export const ASB_PITCH_ACCENT_LINE_CLASS = 'asb-pitch-accent-line';
export const ASB_SUBTITLE_CONTAINER_BOTTOM_CLASS = 'asb-subtitles-container-bottom';
export const ASB_SUBTITLE_CONTAINER_TOP_CLASS = 'asb-subtitles-container-top';
export const ASB_TOKEN_CONTAINER_CLASS = 'asb-token-container';
export const ASB_OVERLAY_DOCUMENT_FOCUSED_CLASS = 'asb-overlay-document-focused';

const tokenSelectionScopeSelector = [
    `.${ASB_SUBTITLE_CONTAINER_BOTTOM_CLASS}`,
    `.${ASB_SUBTITLE_CONTAINER_TOP_CLASS}`,
    `.${ASB_TOKEN_CONTAINER_CLASS}`,
].join(', ');

const tokenSelectionScopeFor = (element: Element): ParentNode =>
    element.closest(tokenSelectionScopeSelector) ?? element.ownerDocument;

const hoverWordSelector = `.${ASB_TOKEN_HOVER_CLASS}`;
const hoverBranchSelector = `${hoverWordSelector} > :is(.${ASB_TOKEN_BASE_CLASS}, .${ASB_TOKEN_ON_CUE_HOVER_CLASS}, .${ASB_TOKEN_ON_WORD_HOVER_CLASS})`;

const hoverBranchFor = (node: Node | null) => {
    const element = node instanceof Element ? node : node?.parentElement;
    const branch = element?.closest(hoverBranchSelector);
    return branch?.parentElement?.classList.contains(ASB_TOKEN_SELECTED_CLASS) ? null : (branch ?? null);
};

const nativeSelectionBindingsByDocument = new WeakMap<
    Document,
    { shadowRootSources: Set<() => readonly ShadowRoot[]>; dispose: () => void }
>();

/**
 * Pins active hover branches during native text selection so mouse movement cannot hide selection endpoints.
 * @returns an unsubscribe callback.
 */
export const bindNativeTokenSelection = (
    document: Document,
    getShadowRoots: () => readonly ShadowRoot[] = () => []
) => {
    let binding = nativeSelectionBindingsByDocument.get(document);
    if (!binding) {
        const shadowRootSources = new Set<() => readonly ShadowRoot[]>();
        binding = {
            shadowRootSources,
            dispose: trackNativeTokenSelection(document, () =>
                Array.from(shadowRootSources).flatMap((roots) => roots())
            ),
        };
        nativeSelectionBindingsByDocument.set(document, binding);
    }
    const source = () => getShadowRoots();
    binding.shadowRootSources.add(source);
    return () => {
        if (!binding.shadowRootSources.delete(source) || binding.shadowRootSources.size) return;
        binding.dispose();
        nativeSelectionBindingsByDocument.delete(document);
    };
};

const appendSelectionEndpoints = (selection: Selection | null | undefined, endpoints: (Node | null)[]) => {
    if (selection && !selection.isCollapsed) endpoints.push(selection.anchorNode, selection.focusNode);
};

const nativeTokenSelection = (document: Document, shadowRoots: readonly ShadowRoot[]) => {
    const selection:
        | (Selection & { getComposedRanges?: (options: { shadowRoots: readonly ShadowRoot[] }) => StaticRange[] })
        | null = document.getSelection();
    if (!selection?.rangeCount) return;

    // Document-level endpoints can be retargeted to a shadow host rather than the selected text.
    if (shadowRoots.length && selection.getComposedRanges) {
        return { composedRanges: selection.getComposedRanges({ shadowRoots }) };
    }

    const selections = [selection];
    for (const root of shadowRoots) {
        const shadowRoot: ShadowRoot & { getSelection?: () => Selection | null } = root;
        const rootSelection = shadowRoot.getSelection?.();
        if (rootSelection) selections.push(rootSelection);
    }
    return { selections };
};

const nativeSelectionEndpoints = (document: Document, shadowRoots: readonly ShadowRoot[]) => {
    const native = nativeTokenSelection(document, shadowRoots);
    if (!native) return [];
    if (native.composedRanges) {
        return native.composedRanges.flatMap((range) =>
            range.collapsed ? [] : [range.startContainer, range.endContainer]
        );
    }
    const endpoints: (Node | null)[] = [];
    for (const selection of native.selections) appendSelectionEndpoints(selection, endpoints);
    return endpoints;
};

const nativeCopyRange = (document: Document, shadowRoots: readonly ShadowRoot[]) => {
    const native = nativeTokenSelection(document, shadowRoots);
    if (!native) return;
    if (native.composedRanges) return native.composedRanges.length === 1 ? native.composedRanges[0] : undefined;
    const selections = native.selections.filter((selection) => !selection.isCollapsed);
    if (selections.length === 1 && selections[0].rangeCount === 1) return selections[0].getRangeAt(0);
};

const trackNativeTokenSelection = (document: Document, getShadowRoots: () => readonly ShadowRoot[]) => {
    let pressedBranch: Element | null = null;
    let pinned = new Set<Element>();

    const sync = () => {
        const branchByWord = new Map<Element, Element>();
        const pin = (branch: Element | null) => {
            const word = branch?.parentElement;
            if (branch?.isConnected && word && !branchByWord.has(word)) branchByWord.set(word, branch);
        };
        pin(pressedBranch); // Pin before the browser starts dragging, so the first mouse move cannot hide the anchor
        for (const node of nativeSelectionEndpoints(document, getShadowRoots())) {
            pin(hoverBranchFor(node));
        }
        const branches = new Set(branchByWord.values());
        for (const branch of pinned) {
            if (!branches.has(branch)) branch.classList.remove(ASB_TOKEN_NATIVE_SELECTION_CLASS);
        }
        for (const branch of branches) {
            if (!pinned.has(branch)) branch.classList.add(ASB_TOKEN_NATIVE_SELECTION_CLASS);
        }
        pinned = branches;
    };

    const press = (event: MouseEvent) => {
        if (event.button !== 0) return;
        const target = event.composedPath()[0];
        pressedBranch = target instanceof Node ? hoverBranchFor(target) : null;
        if (pressedBranch || pinned.size) sync();
    };
    const release = () => {
        if (!pressedBranch) return;
        pressedBranch = null;
        sync();
    };
    const copy = (event: ClipboardEvent) => {
        if (event.defaultPrevented || !event.clipboardData) return;
        const target = event.composedPath()[0];
        if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea'))) {
            return;
        }
        const range = nativeCopyRange(document, getShadowRoots());
        const text = range && selectedSubtitleText(document, range);
        if (text === undefined) return;
        event.clipboardData.setData('text/plain', text);
        event.preventDefault();
    };

    document.addEventListener('mousedown', press, true);
    document.addEventListener('mouseup', release, true);
    document.addEventListener('selectionchange', sync);
    document.addEventListener('copy', copy);
    document.defaultView?.addEventListener('blur', release);
    return () => {
        document.removeEventListener('mousedown', press, true);
        document.removeEventListener('mouseup', release, true);
        document.removeEventListener('selectionchange', sync);
        document.removeEventListener('copy', copy);
        document.defaultView?.removeEventListener('blur', release);
        for (const branch of pinned) branch.classList.remove(ASB_TOKEN_NATIVE_SELECTION_CLASS);
    };
};

export class HoveredToken {
    private _hover: { readonly element: HTMLElement; readonly x: number; readonly y: number } | null = null;

    handleMouseOver(mouseEvent: MouseEvent): void {
        if (!(mouseEvent.target instanceof HTMLElement)) return;
        clearTokenSelectionInRoot(tokenSelectionScopeFor(mouseEvent.target));
        this._hover = { element: mouseEvent.target, x: mouseEvent.clientX, y: mouseEvent.clientY };
    }

    handleMouseOut(mouseEvent: MouseEvent): void {
        if (!(mouseEvent.target instanceof HTMLElement) || this._hover?.element === mouseEvent.target) {
            this._hover = null;
        }
    }

    parse(): { token: string; track: number } | null {
        const hoveredElement = this._hover && this._hover.element;
        const document = hoveredElement?.ownerDocument ?? window.document;
        const selection = document.getSelection();
        const selectedTokenCandidate =
            closestCollectableTokenElement(selection?.anchorNode ?? null) ??
            closestCollectableTokenElement(selection?.focusNode ?? null);
        const hoveredScope = hoveredElement ? tokenSelectionScopeFor(hoveredElement) : undefined;
        const selectedTokenEl =
            selectedTokenCandidate && (!hoveredScope || (hoveredScope as Node).contains(selectedTokenCandidate))
                ? selectedTokenCandidate
                : null;
        const tokenEl = selectedTokenEl?.classList.contains(ASB_TOKEN_SELECTED_CLASS)
            ? selectedTokenEl
            : (closestCollectableTokenElement(hoveredElement) ?? this._tokenInLiveHoverBranch());
        if (!tokenEl) {
            asbTrace('annotations/parse', 'Failed to find token element from hovered element', {
                hoveredElement: hoveredElement?.tagName,
            });
            return null;
        }

        const trackStr = tokenEl.closest('[data-track]')?.getAttribute('data-track');
        if (!trackStr) {
            asbTrace('annotations/parse', 'Failed to parse track from hovered token element', {
                tagName: tokenEl.tagName,
            });
            return null;
        }

        let token = '';
        for (const child of tokenEl.childNodes) token += this._extractTokenFromNode(child);
        token = token.trim();
        if (!token.length) {
            asbTrace('annotations/parse', 'Failed to parse token from hovered token element', {
                tagName: tokenEl.tagName,
            });
            return null;
        }
        const track = parseInt(trackStr);
        asbTrace('annotations/parse', 'Parsed token and track from hovered token element', {
            token,
            track,
        });
        return { token, track };
    }

    private _tokenInLiveHoverBranch(): HTMLElement | null {
        if (!this._hover) return null;
        const { element, x, y } = this._hover;
        const word = element.closest(hoverWordSelector);
        if (!word?.isConnected) return null;

        // A hover swap can hide the mouseover target before the browser retargets the event.
        const hit = word.ownerDocument.elementFromPoint(x, y);
        const token = closestCollectableTokenElement(hit);
        return token?.closest(hoverWordSelector) === word ? token : null;
    }

    private _extractTokenFromNode(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        let token = '';
        const el = node as HTMLElement;
        if (el.tagName === 'RUBY') {
            for (const child of el.childNodes) {
                if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName === 'RT') continue;
                token += this._extractTokenFromNode(child);
            }
            return token;
        }

        for (const child of el.childNodes) token += this._extractTokenFromNode(child);
        return token;
    }
}

export interface SelectTokenInRootOptions {
    autoPause?: boolean;
    onlyIfUnselected?: boolean;
    focusContainer?: boolean;
    scrollIntoView?: boolean;
    selectText?: boolean;
}

const closestAddressableTokenElement = (node: Node | null): HTMLElement | null => {
    if (!node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return element?.closest<HTMLElement>(`[${ASB_TOKEN_START_ATTRIBUTE}]`) ?? null;
};

const closestCollectableTokenElement = (node: Node | null): HTMLElement | null => {
    if (!node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return element?.closest<HTMLElement>(`.${ASB_TOKEN_CLASS}`) ?? null;
};

const numberAttribute = (element: Element, attribute: string): number | undefined => {
    const value = element.getAttribute(attribute);
    if (value === null) return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
};

export const clearTokenSelectionInRoot = (root: ParentNode) => {
    const document = root instanceof Document ? root : root.ownerDocument;
    const selection = document?.getSelection();
    const selectedToken =
        closestAddressableTokenElement(selection?.anchorNode ?? null) ??
        closestAddressableTokenElement(selection?.focusNode ?? null);
    const clearTextSelection =
        selectedToken?.classList.contains(ASB_TOKEN_SELECTED_CLASS) && (root as Node).contains(selectedToken);

    for (const selectedToken of root.querySelectorAll(`.${ASB_TOKEN_SELECTED_CLASS}`)) {
        selectedToken.classList.remove(ASB_TOKEN_SELECTED_CLASS, ASB_TOKEN_AUTO_PAUSE_SELECTED_CLASS);
    }
    for (const selectedSubtitle of root.querySelectorAll(`.${ASB_SUBTITLE_TOKEN_SELECTED_CLASS}`)) {
        selectedSubtitle.classList.remove(ASB_SUBTITLE_TOKEN_SELECTED_CLASS);
    }
    if (clearTextSelection) selection?.removeAllRanges();
};

export const clearAutoPauseTokenSelectionInRoot = (root: ParentNode) => {
    if (root.querySelector(`.${ASB_TOKEN_AUTO_PAUSE_SELECTED_CLASS}`)) clearTokenSelectionInRoot(root);
};

/** Prefers the text selection inside root, then the token marked as selected within root. */
const selectedTokenElementInRoot = (
    root: ParentNode
): { readonly tokenElement: HTMLElement; readonly ownsTextSelection: boolean } | undefined => {
    const document = root instanceof Document ? root : root.ownerDocument;
    if (!document) return;
    const selection = document.getSelection();
    const selectedElement = [
        closestAddressableTokenElement(selection?.anchorNode ?? null),
        closestAddressableTokenElement(selection?.focusNode ?? null),
    ].find((element): element is HTMLElement => element !== null && (root as Node).contains(element));
    if (selectedElement) return { tokenElement: selectedElement, ownsTextSelection: true };
    const markedElement = root.querySelector<HTMLElement>(`[${ASB_TOKEN_START_ATTRIBUTE}].${ASB_TOKEN_SELECTED_CLASS}`);
    return markedElement ? { tokenElement: markedElement, ownsTextSelection: false } : undefined;
};

const tokenElementLocation = (tokenElement: Element): TokenSelectionLocation | undefined => {
    const subtitleElement = tokenElement.closest(`[${ASB_SUBTITLE_INDEX_ATTRIBUTE}]`);
    if (!subtitleElement) return;
    const subtitleIndex = numberAttribute(subtitleElement, ASB_SUBTITLE_INDEX_ATTRIBUTE);
    const tokenStart = numberAttribute(tokenElement, ASB_TOKEN_START_ATTRIBUTE);
    if (subtitleIndex === undefined || tokenStart === undefined) return;
    return { subtitleIndex, tokenStart };
};

export const currentTokenSelectionLocation = (
    subtitles: readonly IndexedSubtitleModel[] | undefined,
    root: ParentNode = window.document
): TokenSelectionLocation | undefined => {
    const selected = selectedTokenElementInRoot(root);
    const location = selected && tokenElementLocation(selected.tokenElement);
    if (!location || !tokenAtLocation(subtitles, location)) return;
    return location;
};

export interface RestorableTokenSelection {
    readonly location: TokenSelectionLocation;
    readonly options: Pick<SelectTokenInRootOptions, 'autoPause' | 'selectText'>;
}

/**
 * Captures the token selection in root so it can be reapplied after re-rendering. The text selection is only
 * restored when root owned it, so re-rendering never takes over a selection elsewhere in the document.
 */
export const restorableTokenSelectionInRoot = (root: ParentNode): RestorableTokenSelection | undefined => {
    const selected = selectedTokenElementInRoot(root);
    const location = selected && tokenElementLocation(selected.tokenElement);
    if (!location) return;
    return {
        location,
        options: {
            autoPause: selected.tokenElement.classList.contains(ASB_TOKEN_AUTO_PAUSE_SELECTED_CLASS),
            selectText: selected.ownsTextSelection,
        },
    };
};

export const selectTokenInRoot = (
    root: ParentNode,
    target: TokenSelectionLocation,
    {
        autoPause = false,
        onlyIfUnselected = false,
        focusContainer = true,
        scrollIntoView = true,
        selectText = true,
    }: SelectTokenInRootOptions = {}
) => {
    if (onlyIfUnselected && restorableTokenSelectionInRoot(root)) return true; // Treat an existing selection as fulfilled so delayed pause selection stops retrying.
    const selector =
        `[${ASB_SUBTITLE_INDEX_ATTRIBUTE}="${target.subtitleIndex}"] ` +
        `[${ASB_TOKEN_START_ATTRIBUTE}="${target.tokenStart}"]`;
    const tokenElements = Array.from(root.querySelectorAll<HTMLElement>(selector));
    if (!tokenElements.length) return false;

    clearTokenSelectionInRoot(root);

    const subtitleElement = tokenElements[0].closest<HTMLElement>(
        '.asb-subtitles, .asbplayer-subtitles, .asbplayer-fullscreen-subtitles'
    );
    subtitleElement?.classList.add(ASB_SUBTITLE_TOKEN_SELECTED_CLASS);
    for (const tokenElement of tokenElements) {
        tokenElement.classList.add(ASB_TOKEN_SELECTED_CLASS);
        tokenElement.closest(`.${ASB_TOKEN_HOVER_CLASS}`)?.classList.add(ASB_TOKEN_SELECTED_CLASS);
        if (autoPause) tokenElement.classList.add(ASB_TOKEN_AUTO_PAUSE_SELECTED_CLASS);
    }

    const tokenElement =
        tokenElements.find((element) => element.closest(`.${ASB_TOKEN_ON_WORD_HOVER_CLASS}`)) ??
        tokenElements.find((element) => element.closest(`.${ASB_TOKEN_ON_CUE_HOVER_CLASS}`)) ??
        tokenElements[0];

    const document = tokenElement.ownerDocument;
    if (focusContainer) {
        const focusableContainer =
            tokenElement.closest<HTMLElement>(`.${ASB_TOKEN_CONTAINER_CLASS}`) ??
            tokenElement.closest<HTMLElement>(
                `.${ASB_SUBTITLE_CONTAINER_BOTTOM_CLASS}, .${ASB_SUBTITLE_CONTAINER_TOP_CLASS}`
            );

        if (focusableContainer) {
            if (!focusableContainer.classList.contains(ASB_TOKEN_CONTAINER_CLASS)) {
                focusableContainer.classList.add(ASB_TOKEN_CONTAINER_CLASS);
                focusableContainer.tabIndex = -1;
            }

            focusableContainer.focus({ preventScroll: true });
        }
    }

    if (selectText) {
        const selection = document.getSelection();
        if (selection) {
            const range = document.createRange();
            range.selectNodeContents(tokenElement);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    if (scrollIntoView) tokenElement.scrollIntoView?.({ block: 'center', inline: 'center' });
    return true;
};
