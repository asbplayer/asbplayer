import { CachedLocalStorage } from './cached-local-storage';
import { expect, it, beforeEach } from '@jest/globals';

beforeEach(() => {
    localStorage.clear();
});

it('reads from local storage', () => {
    const storage = new CachedLocalStorage();
    localStorage.setItem('foo', 'bar');
    expect(storage.get('foo')).toEqual('bar');
});

it('writes to local storage', () => {
    const storage = new CachedLocalStorage();
    storage.set('foo2', 'bar2');
    expect(localStorage.getItem('foo2')).toEqual('bar2');
});

it('getting returns last set value', () => {
    const storage = new CachedLocalStorage();
    storage.set('foo3', 'bar3');
    expect(storage.get('foo3')).toEqual('bar3');
});

it('reads from cache', () => {
    const storage = new CachedLocalStorage();
    storage.set('foo4', 'bar4');
    localStorage.setItem('foo4', 'uncached value');
    expect(storage.get('foo4')).toEqual('bar4');
});
