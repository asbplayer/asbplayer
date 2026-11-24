import { describe, expect, it } from '@jest/globals';
import { toAppLanguage } from '@project/common/util/project';

describe('toAppLanguage', () => {
    const supported = ['en', 'ja', 'pt_BR', 'zh_CN'];

    it('maps browser locales to supported app codes', () => {
        expect(toAppLanguage('pt-BR', supported)).toBe('pt_BR');
        expect(toAppLanguage('zh-CN', supported)).toBe('zh_CN');
        expect(toAppLanguage('en-US', supported)).toBe('en');
        expect(toAppLanguage('ja', supported)).toBe('ja');
    });

    it('falls back through the primary subtag to the default language', () => {
        expect(toAppLanguage('pt-PT', supported, 'en')).toBe('en');
        expect(toAppLanguage('sv-SE', supported, 'en')).toBe('en');
        expect(toAppLanguage('zh-Hans-CN', supported, 'en')).toBe('en');
    });
});
