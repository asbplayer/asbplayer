export const ASB_TOKEN_CLASS = 'asb-token';
export const ASB_TOKEN_HIGHLIGHT_CLASS = 'asb-token-highlight';
export const ASB_READING_CLASS = 'asb-reading';
export const ASB_FREQUENCY_CLASS = 'asb-frequency';
export const ASB_PITCH_ACCENT_CLASS = 'asb-pitch-accent';
export const ASB_PITCH_ACCENT_MORA_CLASS = 'asb-pitch-accent-mora';
export const ASB_PITCH_ACCENT_MORA_HIGH_CLASS = 'asb-pitch-accent-mora-high';
export const ASB_PITCH_ACCENT_MORA_LOW_CLASS = 'asb-pitch-accent-mora-low';
export const ASB_PITCH_ACCENT_LINE_CLASS = 'asb-pitch-accent-line';

export class HoveredToken {
    private _hoveredElement: HTMLElement | null;

    constructor() {
        this._hoveredElement = null;
    }

    handleMouseOver(mouseEvent: MouseEvent): void {
        if (!(mouseEvent.target instanceof HTMLElement)) return;
        this._hoveredElement = mouseEvent.target;
    }

    handleMouseOut(mouseEvent: MouseEvent): void {
        if (!(mouseEvent.target instanceof HTMLElement) || this._hoveredElement === mouseEvent.target) {
            this._hoveredElement = null;
        }
    }

    parse(): { token: string; track: number } | null {
        const tokenEl = this._hoveredElement?.closest(`.${ASB_TOKEN_CLASS}`);
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
