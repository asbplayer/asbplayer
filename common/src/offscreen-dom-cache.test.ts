import { afterEach, describe, expect, it } from '@jest/globals';
import OffscreenDomCache from '@project/common/src/offscreen-dom-cache';

afterEach(() => document.body.replaceChildren());

describe('OffscreenDomCache', () => {
    it('tracks entries created by add and get while retaining existing elements', () => {
        const cache = new OffscreenDomCache();
        expect(cache.empty).toBe(true);
        const first = cache.get('first', () => '<b>first</b>');
        expect(cache.empty).toBe(false);
        cache.add('second', 'second');
        cache.add('first', '<i>updated</i>');

        expect(cache.get('first')).toBe(first);
        expect(first.querySelector('i')?.textContent).toBe('updated');
        expect(cache.keys()).toEqual(['first', 'second']);
        expect(cache.has('second')).toBe(true);
    });

    it('preserves remaining entries and removes the container after the last deletion', () => {
        const cache = new OffscreenDomCache();
        cache.add('first', 'first');
        cache.add('second', 'second');
        const first = cache.get('first');
        const second = cache.get('second');
        cache.delete('missing');
        cache.delete('first');

        expect(first.isConnected).toBe(false);
        expect(cache.keys()).toEqual(['second']);
        expect(cache.empty).toBe(false);
        expect(cache.get('second')).toBe(second);
        expect(second.isConnected).toBe(true);
        cache.delete('second');
        expect(cache.empty).toBe(true);
        expect(cache.keys()).toEqual([]);
        expect(document.querySelector('.asbplayer-offscreen')).toBeNull();

        cache.add('replacement', 'replacement');
        expect(cache.get('replacement').isConnected).toBe(true);
        cache.clear();
        expect(cache.empty).toBe(true);
        expect(cache.has('replacement')).toBe(false);
        expect(document.querySelector('.asbplayer-offscreen')).toBeNull();
    });
});
