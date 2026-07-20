import { keysAreEqual } from '@project/common/app/services/util';
import { describe, expect, it } from '@jest/globals';

describe('keysAreEqual', () => {
    it('treats 0-key objects as equal', () => {
        expect(keysAreEqual({}, {})).toBe(true);
    });

    it('returns true for 1 matching key even when values differ', () => {
        expect(keysAreEqual({ a: 1 }, { a: undefined })).toBe(true);
    });

    it('returns false when one side has an extra key', () => {
        expect(keysAreEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
        expect(keysAreEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    });

    it('compares all keys for 2-key objects', () => {
        expect(keysAreEqual({ a: 1, b: 2 }, { a: 3, b: 4 })).toBe(true);
        expect(keysAreEqual({ a: 1, b: 2 }, { a: 3, c: 4 })).toBe(false);
    });

    it('compares own keys without counting inherited prototype keys', () => {
        const objectWithInheritedKey = Object.create({ inherited: 1 });
        objectWithInheritedKey.a = 1;

        expect(keysAreEqual(objectWithInheritedKey, { a: 2 })).toBe(true);
        expect(keysAreEqual(objectWithInheritedKey, { a: 2, inherited: 3 })).toBe(false);
    });
});
