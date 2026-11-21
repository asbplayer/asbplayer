import { asbTrace } from '@project/common/util/log';
import {
    ASB_SUBTITLE_CONTAINER_BOTTOM_CLASS,
    ASB_SUBTITLE_CONTAINER_TOP_CLASS,
    ASB_TOKEN_CLASS,
    ASB_TOKEN_CONTAINER_CLASS,
    ASB_TOKEN_SELECTED_CLASS,
    elementForNode,
    hoverWordSelector,
} from '@project/common/annotations/dom-annotations';
import { clearTokenSelectionInRoot } from '@project/common/annotations/dom-token-selection';

const tokenSelectionScopeSelector = [
    `.${ASB_SUBTITLE_CONTAINER_BOTTOM_CLASS}`,
    `.${ASB_SUBTITLE_CONTAINER_TOP_CLASS}`,
    `.${ASB_TOKEN_CONTAINER_CLASS}`,
].join(', ');

const tokenSelectionScopeFor = (element: Element): Element | Document =>
    element.closest(tokenSelectionScopeSelector) ?? element.ownerDocument;

const closestCollectableTokenElement = (node: Node | null): HTMLElement | null =>
    elementForNode(node)?.closest<HTMLElement>(`.${ASB_TOKEN_CLASS}`) ?? null;

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
        const hoveredElement = this._hover?.element ?? null;
        const document = hoveredElement?.ownerDocument ?? window.document;
        const selection = document.getSelection();
        const selectedTokenCandidate =
            closestCollectableTokenElement(selection?.anchorNode ?? null) ??
            closestCollectableTokenElement(selection?.focusNode ?? null);
        const hoveredScope = hoveredElement ? tokenSelectionScopeFor(hoveredElement) : undefined;
        const selectedTokenEl =
            selectedTokenCandidate && (!hoveredScope || hoveredScope.contains(selectedTokenCandidate))
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
        if (!token) {
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
