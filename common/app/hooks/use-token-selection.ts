import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { IndexedSubtitleModel } from '@project/common';
import {
    ASB_TOKEN_SELECTED_CLASS,
    ASB_TOKEN_START_ATTRIBUTE,
    clearTokenSelectionInRoot,
    currentTokenSelectionLocation,
    selectTokenInRoot,
} from '@project/common/annotations';
import { findAdjacentTokenJumpMatch } from '@project/common/annotations/token-navigation';
import type { TokenJumpMatch, TokenSelectionLocation } from '@project/common/annotations/token-navigation';
import type { SelectTokenInRootOptions } from '@project/common/annotations/dom-annotations';
import type { SeekableTracks, TokenJumpTarget } from '@project/common/settings';
import { retryWithAnimationFrame } from '@project/common/util';

let lastTokenSelectionOwner: HTMLElement | null = null; // Necessary so VideoPlayer and SubtitlePlayer can coordinate token selection focus (especially after yomitan popup)

const playerContainerFor = (element: Element | null) => {
    const container = element?.closest<HTMLElement>('.asbplayer-token-container') ?? null;
    return container === container?.ownerDocument.body ? null : container;
};

export const claimTokenSelectionFocus = (container: HTMLElement | null) => {
    lastTokenSelectionOwner = container;
};

export const releaseTokenSelectionFocus = (container: HTMLElement) => {
    if (lastTokenSelectionOwner === container) lastTokenSelectionOwner = null;
};

export const restoreClaimedTokenSelectionFocus = (container: HTMLElement) => {
    const activeElement = container.ownerDocument.activeElement;
    if (
        lastTokenSelectionOwner !== container ||
        (activeElement !== container.ownerDocument.body && activeElement !== container) ||
        !container.isConnected
    ) {
        return false;
    }

    container.focus({ preventScroll: true });
    return true;
};

interface TokenSelectionKeyBinder {
    bindJumpToToken(
        onJumpToToken: (event: KeyboardEvent, target: TokenJumpTarget, forward: boolean) => boolean,
        disabledGetter: () => boolean
    ): () => void;
}

export interface TokenSelectionRequestOptions extends SelectTokenInRootOptions {
    claimOwner?: boolean;
}

interface UseTokenSelectionParams {
    rootRef: RefObject<HTMLElement | null>;
    maxAttempts: number;
    keyBinder: TokenSelectionKeyBinder;
    subtitles: readonly IndexedSubtitleModel[] | undefined;
    getCurrentTime: () => number;
    getSeekableTracks: () => SeekableTracks;
    onMatch: (match: TokenJumpMatch) => void;
    onTokenSelectionClaimed?: () => void;
    disabledGetter: () => boolean;
}

export const useTokenSelection = ({
    rootRef,
    maxAttempts,
    keyBinder,
    subtitles,
    getCurrentTime,
    getSeekableTracks,
    onMatch,
    onTokenSelectionClaimed,
    disabledGetter,
}: UseTokenSelectionParams) => {
    const pendingTokenSelectionRef = useRef<TokenSelectionLocation | undefined>(undefined);
    const pendingTokenSelectionOptionsRef = useRef<SelectTokenInRootOptions | undefined>(undefined);
    const activeTokenSelectionRef = useRef<TokenSelectionLocation | undefined>(undefined);
    const activeTokenSelectionOptionsRef = useRef<SelectTokenInRootOptions | undefined>(undefined);
    const tokenSelectionRetryRef = useRef<(() => void) | undefined>(undefined);

    const cancelTokenSelectionRetry = useCallback(() => {
        tokenSelectionRetryRef.current?.();
        tokenSelectionRetryRef.current = undefined;
    }, []);

    const clearPendingTokenSelection = useCallback(() => {
        cancelTokenSelectionRetry();
        pendingTokenSelectionRef.current = undefined;
        pendingTokenSelectionOptionsRef.current = undefined;
    }, [cancelTokenSelectionRetry]);

    const clearTokenSelection = useCallback(() => {
        clearPendingTokenSelection();
        activeTokenSelectionRef.current = undefined;
        activeTokenSelectionOptionsRef.current = undefined;
        const root = rootRef.current;
        if (root) clearTokenSelectionInRoot(root);
    }, [clearPendingTokenSelection, rootRef]);

    const selectPendingToken = useCallback(() => {
        const target = pendingTokenSelectionRef.current;
        const options = pendingTokenSelectionOptionsRef.current;
        const root = rootRef.current;
        if (!target || !root) return false;
        const rootContainer = playerContainerFor(root);
        if (lastTokenSelectionOwner && lastTokenSelectionOwner !== rootContainer) {
            clearPendingTokenSelection();
            return true;
        }
        if (!selectTokenInRoot(root, target, options)) return false;
        activeTokenSelectionRef.current = target;
        activeTokenSelectionOptionsRef.current = options;
        clearPendingTokenSelection();
        return true;
    }, [clearPendingTokenSelection, rootRef]);

    const requestTokenSelection = useCallback(
        (target: TokenSelectionLocation, { claimOwner = false, ...options }: TokenSelectionRequestOptions = {}) => {
            cancelTokenSelectionRetry();
            if (claimOwner) {
                lastTokenSelectionOwner = playerContainerFor(rootRef.current);
                onTokenSelectionClaimed?.();
            }
            activeTokenSelectionRef.current = target;
            activeTokenSelectionOptionsRef.current = options;
            pendingTokenSelectionRef.current = target;
            pendingTokenSelectionOptionsRef.current = options;
            tokenSelectionRetryRef.current = retryWithAnimationFrame(selectPendingToken, maxAttempts);
        },
        [cancelTokenSelectionRetry, maxAttempts, onTokenSelectionClaimed, rootRef, selectPendingToken]
    );

    useEffect(() => cancelTokenSelectionRetry, [cancelTokenSelectionRetry]);

    useEffect(() => {
        const target = activeTokenSelectionRef.current;
        if (target) requestTokenSelection(target, activeTokenSelectionOptionsRef.current);
    }, [requestTokenSelection, subtitles]);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const rootContainer = playerContainerFor(root);
        const clearActiveSelection = (event: MouseEvent) => {
            if (event.target instanceof Element && event.target.closest(`[${ASB_TOKEN_START_ATTRIBUTE}]`)) {
                if (lastTokenSelectionOwner === rootContainer) lastTokenSelectionOwner = null;
                activeTokenSelectionRef.current = undefined;
                activeTokenSelectionOptionsRef.current = undefined;
                clearPendingTokenSelection();
            }
        };
        const restorePlayerFocus = () => {
            if (
                !rootContainer ||
                rootContainer !== lastTokenSelectionOwner ||
                !root.querySelector(`[${ASB_TOKEN_START_ATTRIBUTE}].${ASB_TOKEN_SELECTED_CLASS}`)
            ) {
                return;
            }
            requestAnimationFrame(() => restoreClaimedTokenSelectionFocus(rootContainer));
        };
        root.addEventListener('mouseover', clearActiveSelection);
        window.addEventListener('focus', restorePlayerFocus);
        return () => {
            root.removeEventListener('mouseover', clearActiveSelection);
            window.removeEventListener('focus', restorePlayerFocus);
            if (lastTokenSelectionOwner === rootContainer) lastTokenSelectionOwner = null;
        };
    }, [clearPendingTokenSelection, rootRef]);

    useEffect(() => {
        return keyBinder.bindJumpToToken((event, target, forward) => {
            const root = rootRef.current;
            if (!root) return false;
            const rootContainer = playerContainerFor(root);
            const eventElement = event.target instanceof Element ? event.target : null;
            const eventContainer = playerContainerFor(eventElement);
            const ownerContainer =
                eventElement === document.body && lastTokenSelectionOwner ? lastTokenSelectionOwner : eventContainer;
            if (ownerContainer && ownerContainer !== rootContainer) return false;
            if (event.defaultPrevented) return false;

            const match = findAdjacentTokenJumpMatch(
                subtitles,
                target,
                forward,
                getCurrentTime(),
                getSeekableTracks(),
                currentTokenSelectionLocation(subtitles, root)
            );
            if (!match) return false;

            lastTokenSelectionOwner = rootContainer;
            onTokenSelectionClaimed?.();
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            onMatch(match);
            requestTokenSelection(match);
            return true;
        }, disabledGetter);
    }, [
        keyBinder,
        subtitles,
        getCurrentTime,
        getSeekableTracks,
        onMatch,
        onTokenSelectionClaimed,
        requestTokenSelection,
        disabledGetter,
        rootRef,
    ]);

    return { selectPendingToken, requestTokenSelection, clearTokenSelection };
};
