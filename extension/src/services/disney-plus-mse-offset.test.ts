import { isDisneyPlusPageConfigKey } from './disney-plus-mse-offset';

describe('isDisneyPlusPageConfigKey', () => {
    it('returns true for disneyPlus', () => {
        expect(isDisneyPlusPageConfigKey('disneyPlus')).toBe(true);
    });

    it('returns true for appsDisneyPlus', () => {
        expect(isDisneyPlusPageConfigKey('appsDisneyPlus')).toBe(true);
    });

    it('returns false for other page config keys', () => {
        expect(isDisneyPlusPageConfigKey('netflix')).toBe(false);
        expect(isDisneyPlusPageConfigKey('youtube')).toBe(false);
        expect(isDisneyPlusPageConfigKey('hulu')).toBe(false);
        expect(isDisneyPlusPageConfigKey('huluJp')).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isDisneyPlusPageConfigKey(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(isDisneyPlusPageConfigKey('')).toBe(false);
    });

    it('is case-sensitive (does not match wrong casing)', () => {
        expect(isDisneyPlusPageConfigKey('DisneyPlus')).toBe(false);
        expect(isDisneyPlusPageConfigKey('disneyplus')).toBe(false);
    });
});
