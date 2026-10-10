import { convertDevanagariToUrdu } from '@project/common/subtitle-reader/hindi-urdu-transliteration';

it('leaves text with no Devanagari characters unchanged', () => {
    expect(convertDevanagariToUrdu('Hello, world! 123')).toEqual('Hello, world! 123');
});

it('converts Devanagari text to Urdu script', () => {
    expect(convertDevanagariToUrdu('मुझे हिंदी और उर्दू दोनों पसंद हैं।')).toEqual(
        'مجھے ہندی اور اردو دونوں پسند ہیں۔'
    );
});

it('does not leave Arabic short-vowel diacritics in the output', () => {
    const urdu = convertDevanagariToUrdu('नमस्ते, आप कैसे हैं?');
    expect(urdu).not.toMatch(/[َُِْ]/);
});

it('only converts the Devanagari portion of mixed-script text', () => {
    expect(convertDevanagariToUrdu('This is a mixed line with कुछ हिंदी.')).toEqual(
        'This is a mixed line with کچھ ہندی.'
    );
});

it('uses choti-ye instead of bari-ye for non-word-final e/ai vowels', () => {
    expect(convertDevanagariToUrdu('मेरे')).toEqual('میرے');
    expect(convertDevanagariToUrdu('हैं')).toEqual('ہیں');
    expect(convertDevanagariToUrdu('में')).toEqual('میں');
});

it('does not leak candra-o characters used in English loanwords', () => {
    expect(convertDevanagariToUrdu('ऑप्शन')).not.toMatch(/[ऀ-ॿ]/);
    expect(convertDevanagariToUrdu('फॉरेस्ट')).not.toMatch(/[ऀ-ॿ]/);
});

it('does not produce doubled alif for vowel-hiatus loanwords', () => {
    expect(convertDevanagariToUrdu('टाइम')).not.toMatch(/اا/);
    expect(convertDevanagariToUrdu('माइनक्राफ्ट')).not.toMatch(/اا/);
});

it('does not leak decomposed or unreachable nukta letters', () => {
    expect(convertDevanagariToUrdu('बढ़ता')).not.toMatch(/[ऀ-ॿ]/);
    expect(convertDevanagariToUrdu('पढ़ना')).not.toMatch(/[ऀ-ॿ]/);
});

it('collapses geminate consonants instead of writing the same letter twice', () => {
    expect(convertDevanagariToUrdu('अच्छा')).toEqual('اچھا');
    expect(convertDevanagariToUrdu('अच्छी')).toEqual('اچھی');
});
