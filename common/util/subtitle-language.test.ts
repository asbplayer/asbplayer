import {
    canonicalLanguageTag,
    genericSubtitleDisplayLabel,
    getLocale,
    languageDisplayName,
} from '@project/common/util/subtitle-language';

describe('language names', () => {
    it('parses normalized locales and rejects invalid language tags', () => {
        expect(getLocale(' PT_br ')?.baseName).toBe('pt-BR');
        expect(getLocale('ja-JP-u-ca-japanese')?.language).toBe('ja');
        expect(getLocale('invalid!')).toBeUndefined();
    });

    it('canonicalizes whitespace and underscore-separated BCP-47 language tags', () => {
        expect(canonicalLanguageTag(' PT_br ')).toBe('pt-BR');
    });

    it('removes Unicode locale extensions from canonical language tags', () => {
        expect(canonicalLanguageTag('ja-JP-u-ca-japanese')).toBe('ja-JP');
        const locale = getLocale('ja-JP-u-ca-japanese');
        expect(locale).toBeDefined();
        if (locale) expect(canonicalLanguageTag(locale)).toBe('ja-JP');
    });

    it('returns undefined for invalid language tags', () => {
        expect(canonicalLanguageTag('invalid!')).toBeUndefined();
    });

    it('uses each canonical language autonym with standard language display', () => {
        expect(languageDisplayName('ja')).toBe('日本語');
        expect(languageDisplayName('es-419')).toBe('Español (Latinoamérica)');
        expect(languageDisplayName(' JA_jp-u-ca-japanese ')).toBe('日本語 (日本)');
    });

    it('preserves valid unknown and invalid language tags', () => {
        expect(languageDisplayName('qaa')).toBe('qaa');
        expect(languageDisplayName('invalid!')).toBe('invalid!');
    });
});

describe('genericSubtitleDisplayLabel', () => {
    const fallback = 'Subtitle';

    it('selects the best generic subtitle display label', () => {
        expect(genericSubtitleDisplayLabel('es', undefined, fallback)).toBe('Español');
        expect(genericSubtitleDisplayLabel(undefined, 'es-ES', fallback)).toBe('Español (España)');
        expect(genericSubtitleDisplayLabel(undefined, undefined, fallback)).toBe(fallback);
    });

    it('appends unresolvable language tags to the available label using the dot separator', () => {
        expect(genericSubtitleDisplayLabel('Commentary', 'qaa', fallback)).toBe('Commentary · qaa');
        expect(genericSubtitleDisplayLabel(undefined, 'qaa', fallback)).toBe(`${fallback} · qaa`);
    });

    it.each([
        ['SDH', 'sdh', ['SDH', 'sdh', 'Sdh']],
        ['HI', 'hi', ['HI', 'hi', 'Hi']],
        ['OC', 'oc', ['OC', 'oc', 'Oc']],
        ['VI', 'vi', ['VI', 'vi', 'Vi']],
        ['ALT', 'alt', ['ALT', 'alt', 'Alt']],
        ['FAN', 'fan', ['FAN', 'fan', 'Fan']],
    ])(
        'recognizes the subtitle qualifier %s case-insensitively instead of as language code %s',
        (_qualifier, language, labels) => {
            const languageDisplay = languageDisplayName(language);

            for (const label of labels) {
                expect(genericSubtitleDisplayLabel(label, undefined, fallback)).toBe(label);
                expect(genericSubtitleDisplayLabel(label, language, fallback)).toBe(`${languageDisplay} · ${label}`);
            }
        }
    );

    it('omits language-code labels that are redundant with the supplied language', () => {
        expect(genericSubtitleDisplayLabel('en', 'en', fallback)).toBe('English');
        expect(genericSubtitleDisplayLabel('eng', 'en-US', fallback)).toBe('English (United States)');
        expect(genericSubtitleDisplayLabel('es', 'es-ES', fallback)).toBe('Español (España)');
    });

    it('preserves label details while adding or refining its language display name', () => {
        expect(genericSubtitleDisplayLabel('SDH', 'en-US', fallback)).toBe('English (United States) · SDH');
        expect(genericSubtitleDisplayLabel('English SDH', 'en-US', fallback)).toBe('English (United States) · SDH');
        expect(genericSubtitleDisplayLabel('English (United States) SDH', 'en-US', fallback)).toBe(
            'English (United States) · SDH'
        );
        expect(genericSubtitleDisplayLabel('English', 'en-US', fallback)).toBe('English (United States)');
    });

    it('recognizes localized language names as equivalent to the supplied language', () => {
        expect(genericSubtitleDisplayLabel('Japanese', 'ja', fallback)).toBe('日本語');
        expect(genericSubtitleDisplayLabel('Portuguese', 'pt-BR', fallback)).toBe('Português (Brasil)');
        expect(genericSubtitleDisplayLabel('Spanish commentary', 'es-ES', fallback)).toBe(
            'Español (España) · commentary'
        );
    });

    it.each([
        [undefined, 'eng', 'English'],
        [undefined, 'jpn', '日本語'],
        ['fre', 'fra', 'Français'],
        ['ger', 'deu', 'Deutsch'],
        ['SDH', 'eng', 'English · SDH'],
        ['Japanese', 'jpn', '日本語'],
        ['English commentary', 'eng', 'English · commentary'],
        ['日本語', 'jpn', '日本語'],
        ['Commentary', undefined, 'Commentary'],
        [undefined, undefined, ''],
        ['Commentary', 'qaa', 'Commentary · qaa'],
        [undefined, 'qaa', 'qaa'],
        [undefined, 'und', 'und'],
        ['Commentary', 'invalid!', 'Commentary · invalid!'],
    ])('displays embedded title %s with language %s as %s', (title, language, expected) => {
        expect(genericSubtitleDisplayLabel(title, language, '')).toBe(expected);
    });
});
