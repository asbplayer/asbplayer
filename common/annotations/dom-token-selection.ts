import type { IndexedSubtitleModel } from '@project/common';
import { tokenAtLocation } from '@project/common/annotations/token-navigation';
import type { TokenSelectionLocation } from '@project/common/annotations/token-navigation';
import {
    ASB_SUBTITLE_CONTAINER_BOTTOM_CLASS,
    ASB_SUBTITLE_CONTAINER_TOP_CLASS,
    ASB_SUBTITLE_INDEX_ATTRIBUTE,
    ASB_SUBTITLE_TOKEN_SELECTED_CLASS,
    ASB_TOKEN_AUTO_PAUSE_SELECTED_CLASS,
    ASB_TOKEN_CONTAINER_CLASS,
    ASB_TOKEN_ON_CUE_HOVER_CLASS,
    ASB_TOKEN_ON_WORD_HOVER_CLASS,
    ASB_TOKEN_SELECTED_CLASS,
    ASB_TOKEN_START_ATTRIBUTE,
    elementForNode,
    hoverWordSelector,
} from '@project/common/annotations/dom-annotations';

export interface SelectTokenInRootOptions {
    autoPause?: boolean;
    onlyIfUnselected?: boolean;
    focusContainer?: boolean;
    scrollIntoView?: boolean;
    selectText?: boolean;
}

const closestAddressableTokenElement = (node: Node | null): HTMLElement | null =>
    elementForNode(node)?.closest<HTMLElement>(`[${ASB_TOKEN_START_ATTRIBUTE}]`) ?? null;

const numberAttribute = (element: Element, attribute: string): number | undefined => {
    const value = element.getAttribute(attribute);
    if (value === null) return;
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

    for (const token of root.querySelectorAll(`.${ASB_TOKEN_SELECTED_CLASS}`)) {
        token.classList.remove(ASB_TOKEN_SELECTED_CLASS, ASB_TOKEN_AUTO_PAUSE_SELECTED_CLASS);
    }
    for (const subtitle of root.querySelectorAll(`.${ASB_SUBTITLE_TOKEN_SELECTED_CLASS}`)) {
        subtitle.classList.remove(ASB_SUBTITLE_TOKEN_SELECTED_CLASS);
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
        tokenElement.closest(hoverWordSelector)?.classList.add(ASB_TOKEN_SELECTED_CLASS);
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
