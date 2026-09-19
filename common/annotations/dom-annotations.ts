import type { IndexedSubtitleModel } from '@project/common';
import { tokenAtLocation } from '@project/common/annotations/token-navigation';
import type { TokenSelectionLocation } from '@project/common/annotations/token-navigation';

export const ASB_TOKEN_CLASS = 'asb-token';
export const ASB_TOKEN_HIGHLIGHT_CLASS = 'asb-token-highlight';
export const ASB_TOKEN_SELECTED_CLASS = 'asb-token-selected';
export const ASB_SUBTITLE_TOKEN_SELECTED_CLASS = 'asb-subtitle-token-selected';
export const ASB_SUBTITLE_INDEX_ATTRIBUTE = 'data-asb-subtitle-index';
export const ASB_TOKEN_START_ATTRIBUTE = 'data-asb-token-start';
export const ASB_READING_CLASS = 'asb-reading';
export const ASB_FREQUENCY_CLASS = 'asb-frequency';
export const ASB_PITCH_ACCENT_CLASS = 'asb-pitch-accent';
export const ASB_PITCH_ACCENT_MORA_CLASS = 'asb-pitch-accent-mora';
export const ASB_PITCH_ACCENT_MORA_HIGH_CLASS = 'asb-pitch-accent-mora-high';
export const ASB_PITCH_ACCENT_MORA_LOW_CLASS = 'asb-pitch-accent-mora-low';
export const ASB_PITCH_ACCENT_LINE_CLASS = 'asb-pitch-accent-line';

const tokenSelectionScopeFor = (element: Element): ParentNode =>
    element.closest(
        '.asbplayer-subtitles-container-bottom, .asbplayer-subtitles-container-top, .asbplayer-token-container'
    ) ?? element.ownerDocument;

export class HoveredToken {
    private _hoveredElement: HTMLElement | null;

    constructor() {
        this._hoveredElement = null;
    }

    handleMouseOver(mouseEvent: MouseEvent): void {
        if (!(mouseEvent.target instanceof HTMLElement)) return;
        clearTokenSelectionInRoot(tokenSelectionScopeFor(mouseEvent.target));
        this._hoveredElement = mouseEvent.target;
    }

    handleMouseOut(mouseEvent: MouseEvent): void {
        if (!(mouseEvent.target instanceof HTMLElement) || this._hoveredElement === mouseEvent.target) {
            this._hoveredElement = null;
        }
    }

    parse(): { token: string; track: number } | null {
        const document = this._hoveredElement?.ownerDocument ?? window.document;
        const selection = document.getSelection();
        const selectedTokenCandidate =
            closestCollectableTokenElement(selection?.anchorNode ?? null) ??
            closestCollectableTokenElement(selection?.focusNode ?? null);
        const hoveredScope = this._hoveredElement ? tokenSelectionScopeFor(this._hoveredElement) : undefined;
        const selectedTokenEl =
            selectedTokenCandidate && (!hoveredScope || (hoveredScope as Node).contains(selectedTokenCandidate))
                ? selectedTokenCandidate
                : null;
        const tokenEl = selectedTokenEl?.classList.contains(ASB_TOKEN_SELECTED_CLASS)
            ? selectedTokenEl
            : closestCollectableTokenElement(this._hoveredElement);
        if (!tokenEl) return null;

        const trackStr = tokenEl.closest('[data-track]')?.getAttribute('data-track');
        if (!trackStr) return null;

        let token = '';
        for (const child of tokenEl.childNodes) token += this._extractTokenFromNode(child);
        token = token.trim();
        if (!token.length) return null;
        return { token, track: parseInt(trackStr) };
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
        selectedToken.classList.remove(ASB_TOKEN_SELECTED_CLASS);
    }
    for (const selectedSubtitle of root.querySelectorAll(`.${ASB_SUBTITLE_TOKEN_SELECTED_CLASS}`)) {
        selectedSubtitle.classList.remove(ASB_SUBTITLE_TOKEN_SELECTED_CLASS);
    }
    if (clearTextSelection) selection?.removeAllRanges();
};

export const currentTokenSelectionLocation = (
    subtitles: readonly IndexedSubtitleModel[] | undefined,
    root: ParentNode = window.document
): TokenSelectionLocation | undefined => {
    const document = root instanceof Document ? root : root.ownerDocument;
    if (!document) return;
    const selection = document.getSelection();
    const tokenElement =
        closestAddressableTokenElement(selection?.anchorNode ?? null) ??
        closestAddressableTokenElement(selection?.focusNode ?? null) ??
        root.querySelector<HTMLElement>(`[${ASB_TOKEN_START_ATTRIBUTE}].${ASB_TOKEN_SELECTED_CLASS}`);
    if (!tokenElement || !(root as Node).contains(tokenElement)) return;

    const subtitleElement = tokenElement.closest(`[${ASB_SUBTITLE_INDEX_ATTRIBUTE}]`);
    if (!subtitleElement) return;

    const subtitleIndex = numberAttribute(subtitleElement, ASB_SUBTITLE_INDEX_ATTRIBUTE);
    const tokenStart = numberAttribute(tokenElement, ASB_TOKEN_START_ATTRIBUTE);
    if (subtitleIndex === undefined || tokenStart === undefined) return;

    if (!tokenAtLocation(subtitles, { subtitleIndex, tokenStart })) return;

    return { subtitleIndex, tokenStart };
};

export const selectTokenInRoot = (
    root: ParentNode,
    target: TokenSelectionLocation,
    { focusContainer = true, scrollIntoView = true, selectText = true }: SelectTokenInRootOptions = {}
) => {
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
    for (const tokenElement of tokenElements) tokenElement.classList.add(ASB_TOKEN_SELECTED_CLASS);

    const tokenElement =
        tokenElements.find((element) => element.closest('.asbplayer-subtitle-rich')) ?? tokenElements[0];

    const document = tokenElement.ownerDocument;
    if (focusContainer) {
        tokenElement.closest<HTMLElement>('.asbplayer-token-container')?.focus({ preventScroll: true });
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
