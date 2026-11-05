import React, { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { useLocationHash } from '@project/common/hooks/use-location-hash';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('settings navigation from URLs', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        window.history.replaceState({}, '', '/');
    });

    it.each([
        ['/?view=settings#playback?recipe=compressed', 'playback'],
        ['/?view=settings#annotation', 'annotation'],
        ['/?view=settings', ''],
        ['/#playback?recipe=compressed', undefined],
    ])('selects the settings section for %s', (url, expected) => {
        window.history.replaceState({}, '', url);
        function SettingsSection() {
            const { hash } = useLocationHash({ view: 'settings' });
            return <output>{hash === undefined ? 'closed' : hash}</output>;
        }
        act(() => root.render(<SettingsSection />));
        expect(container.textContent).toBe(expected ?? 'closed');
    });

    it('reopens settings for repeated import links within the same section', () => {
        window.history.replaceState({}, '', '/?view=settings#playback');
        function SettingsDialog() {
            const { hash, url } = useLocationHash({ view: 'settings' });
            const [open, setOpen] = useState(false);
            useEffect(() => {
                if (hash !== undefined) setOpen(true);
            }, [hash, url]);
            return <button onClick={() => setOpen(false)}>{open ? hash : 'closed'}</button>;
        }
        act(() => root.render(<SettingsDialog />));
        for (let index = 0; index < 2; index++) {
            act(() => container.querySelector('button')!.click());
            expect(container.textContent).toBe('closed');
            const newURL = 'http://localhost/?view=settings#playback?recipe=compressed';
            // The importer removes the payload, potentially before this hook receives the event.
            window.history.replaceState({}, '', '/?view=settings#playback');
            act(() => {
                window.dispatchEvent(new HashChangeEvent('hashchange', { newURL }));
            });
            expect(container.textContent).toBe('playback');
        }
    });

    it('updates the section and required parameters on history navigation', () => {
        function SettingsSection() {
            const { hash } = useLocationHash({ view: 'settings' });
            return <output>{hash === undefined ? 'closed' : hash}</output>;
        }
        act(() => root.render(<SettingsSection />));
        expect(container.textContent).toBe('closed');
        window.history.replaceState({}, '', '/?view=settings#annotation');
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        expect(container.textContent).toBe('annotation');
        window.history.replaceState({}, '', '/#playback');
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        expect(container.textContent).toBe('closed');
    });
});
