import project from '@project/common/project';
import type { Command, WriteClipboardMessage } from '@project/common';
import type { ClipboardFallback } from '@project/common/util/clipboard';

const appOrigin = new URL(project.urls.app).origin;
const devOrigin = `http://${project.development.host}:${project.development.port}`;

export interface ClipboardAppOriginOptions {
    readonly allowDevOrigin: boolean;
}

/**
 * Parses a URL into its origin, rejecting opaque `'null'` origins (sandboxed frames, `about:blank`, `data:`)
 * that cannot be tied to a trusted origin. Reconstructs `chrome-extension:` and `moz-extension:` origins when
 * the URL parser returns `'null'`.
 */
export function originOf(url: string | undefined): string | undefined {
    if (!url) return;
    try {
        const parsed = new URL(url);
        if (parsed.origin !== 'null') return parsed.origin;
        if ((parsed.protocol === 'chrome-extension:' || parsed.protocol === 'moz-extension:') && parsed.host) {
            return `${parsed.protocol}//${parsed.host}`;
        }
        return;
    } catch {
        return;
    }
}

/**
 * Checks whether an origin is allowed to request web-app clipboard writes.
 * Rejects `http://localhost` outside dev builds so arbitrary local servers cannot write to the clipboard in production.
 */
export function isClipboardAppOrigin(origin: string, { allowDevOrigin }: ClipboardAppOriginOptions): boolean {
    return origin === appOrigin || (allowDevOrigin && origin === devOrigin);
}

export function isClipboardExtensionOrigin(origin: string): boolean {
    if (origin === 'null' || typeof browser?.runtime?.getURL !== 'function') return false;
    const expected = originOf(browser.runtime.getURL(''));
    return expected !== undefined && origin === expected;
}

/**
 * Fallback that relays clipboard writes to the extension background script.
 * Only callable from isolated extension contexts (content scripts and privileged extension pages).
 * Injected `about:blank` UI iframes and MAIN-world page scripts share the host site's origin and cannot be
 * guaranteed safe from hostile page scripts, so they intentionally have no background clipboard fallback.
 */
export const extensionClipboardFallback: ClipboardFallback = async (data) => {
    const command: Command<WriteClipboardMessage> = {
        sender: 'asbplayer-clipboard-content-script',
        message: { command: 'clipboard-write', data },
    };
    if ((await browser.runtime.sendMessage(command)) !== true) {
        throw new Error('Extension could not write to the clipboard');
    }
};
