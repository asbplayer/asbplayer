import Sanscript from '@indic-transliteration/sanscript';

const devanagariRegex = /[ऀ-ॿ]/;

// Devanagari nukta letters (base consonant + combining nukta U+093C) are frequently written in
// decomposed form (e.g. "ड" + "़") rather than the precomposed single codepoint. Sanscript's
// 'urdu' scheme only recognizes the precomposed form for these, so decomposed input leaks the
// bare nukta mark through untouched unless normalized first.
const nuktaNormalizationMap: Record<string, string> = {
    क़: 'क़', // क + ़ -> क़
    ख़: 'ख़', // ख + ़ -> ख़
    ग़: 'ग़', // ग + ़ -> ग़
    ज़: 'ज़', // ज + ़ -> ज़
    ड़: 'ड़', // ड + ़ -> ड़
    फ़: 'फ़', // फ + ़ -> फ़
    य़: 'य़', // य + ़ -> य़
    // "ढ़" is unreachable in Sanscript's urdu scheme in either form (its own scheme table stores
    // that one entry's key in decomposed form, but the runtime only does single-codepoint
    // lookups, so the mapping can never fire). Fall back to the plain "ढ" (dh) sound instead.
    ढ़: 'ढ', // ढ + ़ -> ढ (decomposed)
    ढ़: 'ढ', // ढ़ (precomposed) -> ढ
};
const nuktaNormalizationRegex = new RegExp(Object.keys(nuktaNormalizationMap).join('|'), 'g');

// Candra-o (used for English loanwords like "option", "forest", "auto") isn't in Sanscript's
// urdu scheme at all, so it leaks through as literal Devanagari. Map to the nearest vowel the
// scheme does handle.
const candraOMap: Record<string, string> = {
    ऑ: 'ओ',
    'ॉ': 'ो',
};
const candraORegex = /ऑ|ॉ/g;

// A vowel matra/independent vowel directly followed by इ/ई or उ/ऊ/ओ/औ (common in loanwords, e.g.
// टाइम "time", माइनक्राफ्ट "Minecraft", दिखाऊंगा "will show") produces a run of bare alifs once
// diacritics are stripped, since both vowels individually reduce to alif. Substituting the
// second vowel with the corresponding glide consonant (य/व) before conversion avoids this. This
// must run on the original Devanagari text, since after conversion the different vowel origins
// become indistinguishable.
const vowelsForHiatus = [
    'अ',
    'आ',
    'इ',
    'ई',
    'उ',
    'ऊ',
    'ऋ',
    'ॠ',
    'ऌ',
    'ॡ',
    'ऎ',
    'ए',
    'ऐ',
    'ऒ',
    'ओ',
    'औ',
    'ा',
    'ि',
    'ी',
    'ु',
    'ू',
    'ृ',
    'ॄ',
    'ॢ',
    'ॣ',
    'ॆ',
    'े',
    'ै',
    'ॊ',
    'ो',
    'ौ',
    'ॅ',
];
const vowelForHiatusRegex = `(?:${vowelsForHiatus.join('|')})`;
const hiatusIRegex = new RegExp(`(${vowelForHiatusRegex})[ईइ]`, 'g');
const hiatusURegex = new RegExp(`(${vowelForHiatusRegex})[औओऊउ]`, 'g');

const arabicShortVowelDiacriticsRegex = /[َُِْ]/g;
const midWordNoonGhunnaRegex = /ں(?=[^\s\p{P}\p{N}\p{Z}])/gu;
// Sanscript maps every "e"/"ai" vowel sound to bari-ye (ے) unconditionally, but real Urdu only
// uses bari-ye when it's the last letter of the word - everywhere else it must be choti-ye (ی).
// Bari-ye never joins forward to the next letter, so using it mid-word breaks the cursive
// joining exactly where real Urdu would flow continuously (e.g. "مےرے" instead of "میرے").
const midWordBariYeRegex = /ے(?=[^\s\p{P}\p{N}\p{Z}])/gu;
// Devanagari consonant gemination (e.g. अच्छा "good") renders as the same Arabic letter written
// twice, since Sanscript maps each half of the geminate independently. Real/casual Urdu doesn't
// double letters this way.
const geminateLetterRegex = /([؀-ۿ])\1/g;

// Sanscript's 'urdu' scheme is a generic Sanskrit-transliteration mapping that marks every
// consonant with an explicit short-vowel diacritic (zabar/zer/pesh) and virama with sukun.
// Real Urdu orthography omits these short vowels almost entirely, so we strip them to
// approximate standard Urdu spelling. This is a heuristic, not a lexical/dictionary-based
// conversion, so loanword spellings and izafat are not handled.
export function convertDevanagariToUrdu(text: string): string {
    if (!devanagariRegex.test(text)) {
        return text;
    }

    let devanagari = text;
    devanagari = devanagari.replace(nuktaNormalizationRegex, (match) => nuktaNormalizationMap[match]);
    devanagari = devanagari.replace(candraORegex, (match) => candraOMap[match]);
    devanagari = devanagari.replace(hiatusIRegex, '$1य');
    devanagari = devanagari.replace(hiatusURegex, '$1व');

    let urdu = Sanscript.t(devanagari, 'devanagari', 'urdu');
    urdu = urdu.replace(arabicShortVowelDiacriticsRegex, '');
    // A mid-word noon ghunna (ں) came from an anusvara before another consonant, which
    // represents a plain nasal consonant in that position rather than vowel nasalization.
    urdu = urdu.replace(midWordNoonGhunnaRegex, 'ن');
    urdu = urdu.replace(midWordBariYeRegex, 'ی');
    urdu = urdu.replace(geminateLetterRegex, '$1');
    return urdu;
}
