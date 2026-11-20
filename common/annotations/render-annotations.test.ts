import { describe, expect, it } from '@jest/globals';
import {
    TokenFrequencyAnnotation,
    TokenReadingAnnotation,
    TokenStatus,
    TokenStyling,
    tokenAnnotationStyleValues,
} from '@project/common/settings';
import type { DictionaryTrack } from '@project/common/settings';
import {
    ASB_TOKEN_BASE_CLASS,
    ASB_TOKEN_HOVER_CLASS,
    ASB_TOKEN_ON_CUE_HOVER_CLASS,
    ASB_TOKEN_ON_WORD_HOVER_CLASS,
} from '@project/common/annotations/dom-annotations';
import type { InternalToken } from '@project/common/annotations/render-annotations';
import {
    computeRichText,
    emptyRichTextWindow,
    getAnnotationsForRender,
    renderRichTextForSubtitle,
    renderRichTextOntoSubtitles,
    renderRichTextWindow,
} from '@project/common/annotations/render-annotations';
import {
    makeDictionaryTrack,
    makeDictionaryTracks,
    makeSubtitle,
    makeToken,
} from '@project/common/annotations/annotations-test-utils';

type AnnotationToggles = {
    color?: boolean;
    reading?: boolean;
    frequency?: boolean;
    gloss?: boolean;
    pitchAccent?: boolean;
};
type HoverAnnotation = keyof Required<AnnotationToggles>;
type HoverCase = [HoverAnnotation, string, AnnotationToggles, ReturnType<typeof makeToken>, string];

const renderToken = (
    fullText: string,
    token: ReturnType<typeof makeToken>,
    dt = makeDictionaryTrack(),
    allowAsciiReading = false
) => {
    const annotations = getAnnotationsForRender(dt, 'video');
    const rendered = computeRichText(
        fullText,
        { tokens: [token] },
        {
            dt,
            enabledAnnotations: annotations.enabledAnnotations,
            allowAsciiReading,
            glossSize: annotations.glossSize,
        }
    );
    if (!annotations.enabledAnnotations.color) {
        return rendered?.replace(/^<span data-asb-token-start="\d+">([\s\S]*)<\/span>$/, '$1');
    }
    return rendered;
};

const tokenVariantClasses = {
    base: ASB_TOKEN_BASE_CLASS,
    cue: ASB_TOKEN_ON_CUE_HOVER_CLASS,
    word: ASB_TOKEN_ON_WORD_HOVER_CLASS,
} as const;

// Read one token's rendered variant without depending on CSS layout in jsdom.
const tokenVariant = (html: string | undefined, variant: keyof typeof tokenVariantClasses) => {
    const root = document.createElement('div');
    root.innerHTML = html ?? '';
    return root.querySelector(`.${tokenVariantClasses[variant]}`)?.innerHTML ?? html;
};

const makeInternalToken = (overrides: Partial<InternalToken> = {}): InternalToken => ({
    ...makeToken(overrides),
    __internal: true,
});

const makeAnnotationTrack = (toggles: AnnotationToggles, overrides: Partial<DictionaryTrack> = {}) => {
    const dt = makeDictionaryTrack(overrides);
    dt.dictionaryTokenAnnotationConfig.colorizeEnabled = toggles.color ?? false;
    for (const config of dt.dictionaryTokenAnnotationConfig.onStatuses) {
        config.reading = toggles.reading ?? false;
        config.frequency = toggles.frequency ?? false;
        config.gloss = toggles.gloss ?? false;
        config.pitchAccent = toggles.pitchAccent ?? false;
    }
    for (const config of dt.dictionaryTokenAnnotationConfig.onStates) {
        config.reading = false;
        config.frequency = false;
        config.gloss = false;
        config.pitchAccent = false;
    }
    for (const target of [
        dt.dictionaryTokenAnnotationConfig.video,
        dt.dictionaryTokenAnnotationConfig.subtitlePlayer,
    ]) {
        target.color.onHoverEnabled = false;
        target.reading.onHoverEnabled = false;
        target.frequency.onHoverEnabled = false;
        target.gloss.onHoverEnabled = false;
        target.pitchAccent.onHoverEnabled = false;
    }
    return dt;
};

const setUnknownTokenColor = (dt: DictionaryTrack, color: string, alpha: string) => {
    dt.dictionaryTokenStatusConfig[TokenStatus.UNKNOWN] = { display: true, color, alpha };
};

const pitchAccentHtml = (moras: string[], color: string, highMoraCount = 1) => {
    const parts: string[] = [];
    for (const [index, mora] of moras.entries()) {
        if (index === highMoraCount) parts.push('<span class="asb-pitch-accent-line"></span>');
        parts.push(
            `<span class="asb-pitch-accent-mora asb-pitch-accent-mora-${
                index < highMoraCount ? 'high' : 'low'
            }">${mora}</span>`
        );
    }
    return `<span class="asb-pitch-accent" style="--asb-pitch-accent-color: ${color};">${parts.join('')}</span>`;
};

const expectedAnnotationCombinationHtml = ({
    color = false,
    reading = false,
    frequency = false,
    gloss = false,
    pitchAccent = false,
}: AnnotationToggles) => {
    const colorValue = '#11223344';
    let tokenText = '語学';

    if (reading) {
        tokenText = `<ruby class="asb-reading">語学<rt>${
            pitchAccent ? pitchAccentHtml(['ご', 'が', 'く'], color ? colorValue : 'currentColor') : 'ごがく'
        }</rt></ruby>`;
    }
    if (frequency) {
        tokenText = `<ruby class="asb-frequency">${tokenText}<rt>7</rt></ruby>`;
    }
    if (gloss) {
        tokenText = `<ruby class="asb-gloss"><ruby class="asb-gloss">${tokenText}<rt><span class="asb-gloss-text">ion</span></rt></ruby><rt><span class="asb-gloss-text">definit-</span></rt></ruby>`;
    }
    if (!color) return tokenText;
    if (pitchAccent && reading) {
        return `<span class="asb-token asb-token-highlight" data-asb-token-start="0">${tokenText}</span>`;
    }
    return `<span class="asb-token asb-token-highlight" data-asb-token-start="0" style="text-decoration: UNDERLINE ${colorValue} 3px;">${tokenText}</span>`;
};

const annotationCombinations: Required<AnnotationToggles>[] = [];
for (const color of [false, true]) {
    for (const reading of [false, true]) {
        for (const frequency of [false, true]) {
            for (const gloss of [false, true]) {
                for (const pitchAccent of [false, true]) {
                    annotationCombinations.push({ color, reading, frequency, gloss, pitchAccent });
                }
            }
        }
    }
}

describe('rich text rendering', () => {
    it('skips subtitles that cannot be rendered and rejects incomplete track configuration', () => {
        const tracks = makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true }));
        const withoutTokenization = makeSubtitle({ tokenization: undefined });

        expect(
            renderRichTextOntoSubtitles([withoutTokenization], 'video', tracks, { adaptiveWordVisibilityEnabled: true })
        ).toEqual(new Map());
        expect(
            renderRichTextOntoSubtitles([makeSubtitle()], 'video', tracks.slice(0, 1), {
                adaptiveWordVisibilityEnabled: true,
            })
        ).toEqual(new Map());
        expect(computeRichText('plain', { tokens: [] }, {} as any)).toBeUndefined();
    });

    it('renders colored tokens and tokenization errors into the returned map', () => {
        const subtitles = [
            makeSubtitle({
                text: '語学',
                tokenization: { tokens: [makeToken({ pos: [0, 2], status: TokenStatus.UNKNOWN })] },
            }),
            makeSubtitle({ index: 1, text: 'broken', tokenization: { tokens: [], error: true } }),
        ];
        const rendered = renderRichTextOntoSubtitles(
            subtitles,
            'video',
            makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true })),
            { adaptiveWordVisibilityEnabled: true }
        );

        expect(rendered.get(0)?.richText).toContain('class="asb-token asb-token-highlight"');
        expect(rendered.get(1)?.richText).toBe('<span style="text-decoration: line-through red 3px;">broken</span>');
    });

    it('renders null token statuses with error styling', () => {
        expect(renderToken('語学', makeToken({ pos: [0, 2], status: null }))).toBe(
            '<span data-asb-token-start="0" style="text-decoration: line-through red 3px;">語学</span>'
        );
    });

    it('hides nonmatching words while keeping selected words visible', () => {
        const dt = makeAnnotationTrack({});
        const config = JSON.parse(JSON.stringify(dt.dictionaryPlaybackConfig));
        config.wordVisibility.onStatuses[TokenStatus.UNKNOWN].enabled = true;
        const track = { ...dt, dictionaryPlaybackConfig: config };
        const subtitle = makeSubtitle({
            text: '語 学',
            tokenization: {
                tokens: [
                    makeToken({ pos: [0, 1], status: TokenStatus.MATURE }),
                    makeToken({ pos: [2, 3], status: TokenStatus.UNKNOWN }),
                ],
            },
        });
        const rendered = renderRichTextOntoSubtitles([subtitle], 'video', makeDictionaryTracks(track), {
            adaptiveWordVisibilityEnabled: true,
        });
        expect(rendered.get(0)?.richText).toContain('class="asb-token-adaptive-hidden" data-asb-token-start="0"');
        expect(rendered.get(0)?.richText).toContain('<span data-asb-token-start="2">学</span>');
        const notShownDuringPlayback = renderRichTextOntoSubtitles([subtitle], 'video', makeDictionaryTracks(track), {
            adaptiveWordVisibilityEnabled: false,
        });
        expect(notShownDuringPlayback.get(0)?.richText).not.toContain('asb-token-adaptive-hidden');

        config.wordVisibility.wholeSubtitleMatchThreshold = 1;
        const belowWholeSubtitleThreshold = renderRichTextOntoSubtitles(
            [subtitle],
            'video',
            makeDictionaryTracks(track),
            { adaptiveWordVisibilityEnabled: true }
        );
        expect(belowWholeSubtitleThreshold.get(0)?.richText).toContain('asb-token-adaptive-hidden');

        config.wordVisibility.hideWordsIndividuallyUntilThreshold = false;
        const wholeSubtitleOnly = renderRichTextOntoSubtitles([subtitle], 'video', makeDictionaryTracks(track), {
            adaptiveWordVisibilityEnabled: true,
        });
        expect(wholeSubtitleOnly.get(0)?.richText).not.toContain('asb-token-adaptive-hidden');

        config.wordVisibility.wholeSubtitleMatchThreshold = 0.5;
        const atWholeSubtitleThreshold = renderRichTextOntoSubtitles([subtitle], 'video', makeDictionaryTracks(track), {
            adaptiveWordVisibilityEnabled: true,
        });
        expect(atWholeSubtitleThreshold.get(0)?.richText).not.toContain('asb-token-adaptive-hidden');
    });

    it('shows selected words within the frequency limit and leaves punctuation visible', () => {
        const dt = makeAnnotationTrack({});
        dt.dictionaryPlaybackConfig.wordVisibility.onStatuses[TokenStatus.UNCOLLECTED].enabled = true;
        dt.dictionaryPlaybackConfig.wordVisibility.rules.maxFrequency = 10000;
        const subtitle = makeSubtitle({
            text: '語 学。',
            tokenization: {
                tokens: [
                    makeToken({ pos: [0, 1], status: TokenStatus.UNCOLLECTED, frequency: 9000 }),
                    makeToken({ pos: [2, 3], status: TokenStatus.UNCOLLECTED, frequency: 10001 }),
                    makeToken({ pos: [3, 4], status: TokenStatus.UNKNOWN }),
                ],
            },
        });
        const rendered = renderRichTextOntoSubtitles([subtitle], 'video', makeDictionaryTracks(dt), {
            adaptiveWordVisibilityEnabled: true,
        });
        expect(rendered.get(0)?.richText).toContain('<span data-asb-token-start="0">語</span>');
        expect(rendered.get(0)?.richText).toContain('class="asb-token-adaptive-hidden" data-asb-token-start="2"');
        expect(rendered.get(0)?.richText).toContain('学</span>。');
    });

    it('wraps letter tokens even when color annotations are disabled', () => {
        const dt = makeAnnotationTrack({});
        const rendered = renderRichTextOntoSubtitles(
            [
                makeSubtitle({
                    text: '語。',
                    tokenization: {
                        tokens: [
                            makeToken({ pos: [0, 1], status: TokenStatus.UNKNOWN }),
                            makeToken({ pos: [1, 2], status: TokenStatus.UNKNOWN }),
                        ],
                    },
                }),
            ],
            'video',
            makeDictionaryTracks(dt),
            { adaptiveWordVisibilityEnabled: true }
        );
        expect(rendered.get(0)?.richText).toBe('<span data-asb-token-start="0">語</span>。');
    });

    it('keeps hover-only annotations in each token’s cue variant', () => {
        const rendered = renderRichTextOntoSubtitles(
            [
                makeSubtitle({
                    text: '語学',
                    tokenization: { tokens: [makeToken({ pos: [0, 2], status: TokenStatus.UNKNOWN })] },
                }),
            ],
            'video',
            makeDictionaryTracks(
                makeDictionaryTrack({ dictionaryColorizeSubtitles: true, dictionaryColorizeOnHoverOnly: true })
            ),
            { adaptiveWordVisibilityEnabled: true }
        );

        expect(tokenVariant(rendered.get(0)?.richText, 'base')).toBe('<span data-asb-token-start="0">語学</span>');
        expect(tokenVariant(rendered.get(0)?.richText, 'cue')).toContain('asb-token');
    });

    it('renders reading and frequency annotations through computeRichText', () => {
        const rendered = renderToken(
            '語学',
            makeToken({
                pos: [0, 2],
                status: TokenStatus.UNCOLLECTED,
                readings: [{ pos: [0, 2], reading: 'ごがく' }],
                frequency: 12,
            }),
            makeDictionaryTrack({
                dictionaryColorizeSubtitles: true,
                dictionaryTokenReadingAnnotation: TokenReadingAnnotation.ALWAYS,
                dictionaryTokenFrequencyAnnotation: TokenFrequencyAnnotation.ALWAYS,
                dictionaryTokenStyling: TokenStyling.UNDERLINE,
            })
        );

        expect(rendered).toContain('<ruby class="asb-reading">語学<rt>ごがく</rt></ruby>');
        expect(rendered).toContain('<ruby class="asb-frequency">');
        expect(rendered).toContain('text-decoration: UNDERLINE #FF0000FF 3px;');
    });

    it.each(annotationCombinations)('renders annotation combination %# from DictionaryTrack settings', (toggles) => {
        const dt = makeAnnotationTrack(toggles, { dictionaryTokenStyling: TokenStyling.UNDERLINE });
        setUnknownTokenColor(dt, '#112233', '44');

        const rendered = renderToken(
            '語学',
            makeInternalToken({
                pos: [0, 2],
                status: TokenStatus.UNKNOWN,
                readings: [{ pos: [0, 2], reading: 'ごがく' }],
                frequency: 7,
                gloss: 'definition',
                pitchAccent: 1,
            }),
            dt
        );

        expect(rendered).toBe(expectedAnnotationCombinationHtml(toggles));
    });

    it('renders short plain-text glosses above a single line', () => {
        expect(
            renderToken(
                'word',
                makeInternalToken({
                    pos: [0, 4],
                    status: TokenStatus.UNKNOWN,
                    gloss: 'sense',
                }),
                makeAnnotationTrack({ gloss: true })
            )
        ).toBe('<ruby class="asb-gloss">word<rt><span class="asb-gloss-text">sense</span></rt></ruby>');
    });

    it.each([
        ['<&>', '&lt;&amp;&gt;'],
        ['&lt;img&gt;', '&amp;lt;img&amp;gt;'],
    ])('escapes plain-text gloss content when rendering HTML: %s', (gloss, expectedGloss) => {
        expect(
            renderToken(
                'longword',
                makeInternalToken({
                    pos: [0, 8],
                    status: TokenStatus.UNKNOWN,
                    gloss,
                }),
                makeAnnotationTrack({ gloss: true })
            )
        ).toBe(`<ruby class="asb-gloss">longword<rt><span class="asb-gloss-text">${expectedGloss}</span></rt></ruby>`);
    });

    it('does not render a null gloss', () => {
        expect(
            renderToken(
                'word',
                makeInternalToken({
                    pos: [0, 4],
                    status: TokenStatus.UNKNOWN,
                    gloss: null,
                }),
                makeAnnotationTrack({ gloss: true })
            )
        ).toBe('word');
    });

    it.each([
        ['to escape (disaster, death, etc.)', 'to escape'],
        ['逃れる（災害・死など）', '逃れる'],
        ['escape [danger]', 'escape'],
        ['escape ［danger］', 'escape'],
        ['escape 【danger】', 'escape'],
        ['escape {danger}', 'escape'],
        ['escape ｛danger｝', 'escape'],
        ['échapper (à un danger)', 'échapper'],
        ['term (note (additional detail))', 'term'],
        ['escape; avoid; evade', 'escape'],
        ['逃れる；避ける', '逃れる'],
        ['entkommen | vermeiden', 'entkommen'],
        ['слово • выражение', 'слово'],
        ['語 ・ 表現', '語'],
        ['escape (danger).', 'escape'],
    ])('compacts supplementary text and later senses without assuming a language: %s', (gloss, expectedGloss) => {
        const tokenText = 'representative-token';
        expect(
            renderToken(
                tokenText,
                makeInternalToken({
                    pos: [0, tokenText.length],
                    status: TokenStatus.UNKNOWN,
                    gloss,
                }),
                makeAnnotationTrack({ gloss: true })
            )
        ).toBe(
            `<ruby class="asb-gloss">${tokenText}<rt><span class="asb-gloss-text">${expectedGloss}</span></rt></ruby>`
        );
    });

    it.each(['(obsolete)', 'word (unclosed note'])(
        'retains the normalized original when generic compaction cannot produce a safe replacement: %s',
        (gloss) => {
            const tokenText = 'representative-token';
            expect(
                renderToken(
                    tokenText,
                    makeInternalToken({
                        pos: [0, tokenText.length],
                        status: TokenStatus.UNKNOWN,
                        gloss,
                    }),
                    makeAnnotationTrack({ gloss: true })
                )
            ).toBe(`<ruby class="asb-gloss">${tokenText}<rt><span class="asb-gloss-text">${gloss}</span></rt></ruby>`);
        }
    );

    it.each([
        ['abcdefgh', '<ruby class="asb-gloss">word<rt><span class="asb-gloss-text">abcdefgh</span></rt></ruby>'],
        [
            'abcdefghijkl',
            '<ruby class="asb-gloss"><ruby class="asb-gloss">word<rt><span class="asb-gloss-text">hijkl</span></rt></ruby><rt><span class="asb-gloss-text">abcdefg-</span></rt></ruby>',
        ],
        [
            'abcdefghijklmnop',
            '<span class="asb-gloss-popup" data-asb-gloss="abcdefghijklmnop"><ruby class="asb-gloss"><ruby class="asb-gloss">word<rt><span class="asb-gloss-text">hijklmn-</span></rt></ruby><rt><span class="asb-gloss-text">abcdefg-</span></rt></ruby></span>',
        ],
    ])('fits gloss lines by estimated rendered width: %s', (gloss, expectedHtml) => {
        expect(
            renderToken(
                'word',
                makeInternalToken({
                    pos: [0, 4],
                    status: TokenStatus.UNKNOWN,
                    gloss,
                }),
                makeAnnotationTrack({ gloss: true })
            )
        ).toBe(expectedHtml);
    });

    it.each([
        ['生身', 'living flesh', 'flesh', 'living'],
        ['word', 'abcdefgh ij', 'ij', 'abcdefgh'],
    ])('wraps the gloss for %s at whitespace without adding a hyphen', (tokenText, gloss, innerLine, outerLine) => {
        expect(
            renderToken(
                tokenText,
                makeInternalToken({ pos: [0, tokenText.length], gloss }),
                makeAnnotationTrack({ gloss: true })
            )
        ).toBe(
            `<ruby class="asb-gloss"><ruby class="asb-gloss">${tokenText}<rt><span class="asb-gloss-text">${innerLine}</span></rt></ruby><rt><span class="asb-gloss-text">${outerLine}</span></rt></ruby>`
        );
    });

    it('retains a trailing hyphen and hover popup when the second line is truncated', () => {
        expect(
            renderToken(
                '生身',
                makeInternalToken({ pos: [0, 2], gloss: 'living fleshlyyy' }),
                makeAnnotationTrack({ gloss: true })
            )
        ).toBe(
            '<span class="asb-gloss-popup" data-asb-gloss="living fleshlyyy"><ruby class="asb-gloss"><ruby class="asb-gloss">生身<rt><span class="asb-gloss-text">fleshly-</span></rt></ruby><rt><span class="asb-gloss-text">living</span></rt></ruby></span>'
        );
    });

    it('accounts for full-width token text and the configured gloss font size', () => {
        const dt = makeAnnotationTrack({ gloss: true });

        expect(renderToken('語学', makeInternalToken({ pos: [0, 2], gloss: 'abcdefgh' }), dt)).toBe(
            '<ruby class="asb-gloss">語学<rt><span class="asb-gloss-text">abcdefgh</span></rt></ruby>'
        );

        dt.dictionaryTokenAnnotationConfig.video.gloss.size = 1;
        expect(renderToken('語学', makeInternalToken({ pos: [0, 2], gloss: 'abcdefgh' }), dt)).toBe(
            '<span class="asb-gloss-popup" data-asb-gloss="abcdefgh"><ruby class="asb-gloss"><ruby class="asb-gloss">語学<rt><span class="asb-gloss-text">def-</span></rt></ruby><rt><span class="asb-gloss-text">abc-</span></rt></ruby></span>'
        );
    });

    it('reuses gloss layout across renders without reusing token annotations or target sizes', () => {
        const dt = makeAnnotationTrack({ gloss: true, reading: true, frequency: true });
        dt.dictionaryTokenAnnotationConfig.subtitlePlayer.gloss.size = 1;
        const token = makeInternalToken({
            pos: [0, 2],
            gloss: 'abcdefghijklmnop',
            frequency: 7,
            readings: [{ pos: [0, 2], reading: 'ごがく' }],
        });
        const subtitle = makeSubtitle({ text: '語学', tokenization: { tokens: [token] } });
        const root = document.createElement('div');
        const render = (target: 'video' | 'subtitlePlayer') => {
            root.innerHTML =
                renderRichTextOntoSubtitles([subtitle], target, makeDictionaryTracks(dt), {
                    adaptiveWordVisibilityEnabled: true,
                }).get(subtitle.index)?.richText ?? '';
            return Array.from(root.querySelectorAll('.asb-gloss-text'), (line) => line.textContent);
        };

        expect(render('video')).toEqual(['hijklmn-', 'abcdefg-']);
        expect(root.querySelector('.asb-reading > rt')?.textContent).toBe('ごがく');
        token.frequency = 9;
        token.readings = [{ pos: [0, 2], reading: 'がくしゅう' }];
        expect(render('video')).toEqual(['hijklmn-', 'abcdefg-']);
        expect(root.querySelector('.asb-frequency > rt')?.textContent).toBe('9');
        expect(root.querySelector('.asb-reading > rt')?.textContent).toBe('がくしゅう');
        expect(render('subtitlePlayer')).toEqual(['def-', 'abc-']);
        expect(render('video')).toEqual(['hijklmn-', 'abcdefg-']);
        token.gloss = 'other';
        expect(render('video')).toEqual(['other']);
        expect(root.querySelector('.asb-gloss-popup')).toBeNull();
    });

    it('includes the escaped full gloss in a popup only when the displayed gloss is truncated', () => {
        const rendered = renderToken(
            'word',
            makeInternalToken({ pos: [0, 4], gloss: '0123456789 "quoted" & <tag>' }),
            makeAnnotationTrack({ gloss: true })
        );

        expect(rendered).toContain(
            '<span class="asb-gloss-popup" data-asb-gloss="0123456789 &quot;quoted&quot; &amp; &lt;tag&gt;">'
        );
        expect(
            renderToken(
                'word',
                makeInternalToken({ pos: [0, 4], gloss: 'sense' }),
                makeAnnotationTrack({ gloss: true })
            )
        ).not.toContain('asb-gloss-popup');
    });

    it('prepares shared glosses according to each word and keeps distinct definitions and popup text', () => {
        const dt = makeAnnotationTrack({ gloss: true });
        const root = document.createElement('div');
        root.innerHTML =
            computeRichText(
                'word 語 word word',
                {
                    tokens: [
                        makeInternalToken({ pos: [0, 4], gloss: 'abcdefghijklmnop (first)' }),
                        makeInternalToken({ pos: [5, 6], gloss: 'abcdefghijklmnop (first)' }),
                        makeInternalToken({ pos: [7, 11], gloss: 'other' }),
                        makeInternalToken({ pos: [12, 16], gloss: 'abcdefghijklmnop (second)' }),
                    ],
                },
                { ...getAnnotationsForRender(dt, 'video'), allowAsciiReading: false }
            ) ?? '';

        const tokens = Array.from(root.children);
        expect(
            tokens.map((token) => Array.from(token.querySelectorAll('.asb-gloss-text'), (line) => line.textContent))
        ).toEqual([['hijklmn-', 'abcdefg-'], ['def-', 'abc-'], ['other'], ['hijklmn-', 'abcdefg-']]);
        expect(tokens.map((token) => token.querySelector('.asb-gloss-popup')?.getAttribute('data-asb-gloss'))).toEqual([
            'abcdefghijklmnop (first)',
            'abcdefghijklmnop (first)',
            undefined,
            'abcdefghijklmnop (second)',
        ]);
    });

    it('keeps shared gloss text independent of line placement and hover-only readings and frequencies', () => {
        const dt = makeAnnotationTrack({ gloss: true, reading: true, frequency: true });
        const config = dt.dictionaryTokenAnnotationConfig.video;
        config.frequency.onHoverEnabled = true;
        config.reading.onHoverEnabled = true;
        config.reading.hoverPerToken = true;
        const root = document.createElement('div');
        root.innerHTML =
            computeRichText(
                '語学\n語学',
                {
                    tokens: [
                        makeInternalToken({
                            pos: [0, 2],
                            gloss: 'abcdefghijkl',
                            readings: [{ pos: [0, 2], reading: 'ごがく' }],
                            frequency: 7,
                        }),
                        makeInternalToken({
                            pos: [3, 5],
                            gloss: 'abcdefghijkl',
                            readings: [{ pos: [0, 2], reading: 'がくしゅう' }],
                            frequency: 9,
                        }),
                    ],
                },
                { ...getAnnotationsForRender(dt, 'video'), allowAsciiReading: false }
            ) ?? '';

        for (const [index, token] of Array.from(root.children).entries()) {
            for (const [variant, className] of Object.entries(tokenVariantClasses)) {
                const branch = token.querySelector(`.${className}`)!;
                expect(Array.from(branch.querySelectorAll('.asb-gloss-text'), (line) => line.textContent)).toEqual(
                    index === 0 ? ['hijkl', 'abcdefg-'] : ['abcdefg-', 'hijkl']
                );
                expect(branch.querySelector('.asb-gloss-under') !== null).toBe(index === 1);
                expect(branch.querySelector('.asb-frequency > rt')?.textContent).toBe(
                    variant === 'base' ? undefined : ['7', '9'][index]
                );
                expect(branch.querySelector('.asb-reading > rt')?.textContent).toBe(
                    variant === 'word' ? ['ごがく', 'がくしゅう'][index] : undefined
                );
            }
        }
    });

    it('renders glosses below the bottom subtitle line', () => {
        const dt = makeAnnotationTrack({ gloss: true });
        const rendered = computeRichText(
            'top\nbottom',
            {
                tokens: [
                    makeInternalToken({ pos: [0, 3], gloss: 'upper' }),
                    makeInternalToken({ pos: [4, 10], gloss: 'lower' }),
                ],
            },
            {
                dt,
                enabledAnnotations: getAnnotationsForRender(dt, 'video').enabledAnnotations,
                allowAsciiReading: false,
                glossSize: getAnnotationsForRender(dt, 'video').glossSize,
            }
        );

        expect(rendered).toBe(
            '<span data-asb-token-start="0"><ruby class="asb-gloss">top<rt><span class="asb-gloss-text">upper</span></rt></ruby></span>\n' +
                '<span data-asb-token-start="4"><ruby class="asb-gloss asb-gloss-under">bottom<rt><span class="asb-gloss-text">lower</span></rt></ruby></span>'
        );
    });

    it('keeps glosses above middle lines when a subtitle has three or more lines', () => {
        const dt = makeAnnotationTrack({ gloss: true });
        const rendered = computeRichText(
            'top\nmiddle\nbottom',
            {
                tokens: [
                    makeInternalToken({ pos: [0, 3], gloss: 'upper' }),
                    makeInternalToken({ pos: [4, 10], gloss: 'center' }),
                    makeInternalToken({ pos: [11, 17], gloss: 'lower' }),
                ],
            },
            {
                dt,
                enabledAnnotations: getAnnotationsForRender(dt, 'video').enabledAnnotations,
                allowAsciiReading: false,
                glossSize: getAnnotationsForRender(dt, 'video').glossSize,
            }
        );

        expect(rendered).toBe(
            '<span data-asb-token-start="0"><ruby class="asb-gloss">top<rt><span class="asb-gloss-text">upper</span></rt></ruby></span>\n' +
                '<span data-asb-token-start="4"><ruby class="asb-gloss">middle<rt><span class="asb-gloss-text">center</span></rt></ruby></span>\n' +
                '<span data-asb-token-start="11"><ruby class="asb-gloss asb-gloss-under">bottom<rt><span class="asb-gloss-text">lower</span></rt></ruby></span>'
        );
    });

    it('keeps both lines of a long bottom-line gloss in reading order', () => {
        const dt = makeAnnotationTrack({ gloss: true });
        const rendered = computeRichText(
            'top\nword',
            {
                tokens: [
                    makeInternalToken({ pos: [0, 3], gloss: 'top' }),
                    makeInternalToken({ pos: [4, 8], gloss: 'abcdefghijkl' }),
                ],
            },
            {
                dt,
                enabledAnnotations: getAnnotationsForRender(dt, 'video').enabledAnnotations,
                allowAsciiReading: false,
                glossSize: getAnnotationsForRender(dt, 'video').glossSize,
            }
        );

        expect(rendered).toBe(
            '<span data-asb-token-start="0"><ruby class="asb-gloss">top<rt><span class="asb-gloss-text">top</span></rt></ruby></span>\n' +
                '<span data-asb-token-start="4"><ruby class="asb-gloss asb-gloss-under">' +
                '<ruby class="asb-gloss asb-gloss-under">word<rt><span class="asb-gloss-text">abcdefg-</span></rt></ruby>' +
                '<rt><span class="asb-gloss-text">hijkl</span></rt></ruby></span>'
        );
    });

    it.each([
        [TokenStyling.TEXT, '-webkit-text-fill-color: #12345680;'],
        [TokenStyling.BACKGROUND, 'background-color: #12345680;'],
        [TokenStyling.UNDERLINE, 'text-decoration: UNDERLINE #12345680 5px;'],
        [TokenStyling.OVERLINE, 'text-decoration: OVERLINE #12345680 5px;'],
        [TokenStyling.OUTLINE, '-webkit-text-stroke: 5px #12345680;'],
    ])('renders %s color styling with configured color and alpha', (style, expectedStyle) => {
        const dt = makeAnnotationTrack(
            { color: true },
            {
                dictionaryHighlightOnHover: false,
                dictionaryTokenStyling: style,
                dictionaryTokenStylingThickness: 5,
            }
        );
        setUnknownTokenColor(dt, '#123456', '80');

        expect(renderToken('語学', makeInternalToken({ pos: [0, 2], status: TokenStatus.UNKNOWN }), dt)).toBe(
            `<span class="asb-token" data-asb-token-start="0" style="${expectedStyle}">語学</span>`
        );
    });

    it('adds the highlight class only when configured', () => {
        expect(
            renderToken(
                '語学',
                makeInternalToken({ pos: [0, 2], status: TokenStatus.UNKNOWN }),
                makeAnnotationTrack({ color: true }, { dictionaryHighlightOnHover: true })
            )
        ).toContain('class="asb-token asb-token-highlight"');

        expect(
            renderToken(
                '語学',
                makeInternalToken({ pos: [0, 2], status: TokenStatus.UNKNOWN }),
                makeAnnotationTrack({ color: true }, { dictionaryHighlightOnHover: false })
            )
        ).toContain('class="asb-token"');
    });

    it('renders pitch accent directly on kana tokens when no reading annotation is needed', () => {
        const dt = makeAnnotationTrack({ color: true, pitchAccent: true });
        setUnknownTokenColor(dt, '#334455', '66');

        expect(
            renderToken('かな', makeInternalToken({ pos: [0, 2], status: TokenStatus.UNKNOWN, pitchAccent: 1 }), dt)
        ).toBe(
            `<span class="asb-token asb-token-highlight" data-asb-token-start="0">${pitchAccentHtml(
                ['か', 'な'],
                '#33445566'
            )}</span>`
        );
    });

    it('keeps coloring on hover when pitch accent data has no renderable kana text', () => {
        const dt = makeAnnotationTrack({ color: true, pitchAccent: true });
        setUnknownTokenColor(dt, '#334455', '66');
        dt.dictionaryTokenAnnotationConfig.video.color.onHoverEnabled = true;
        dt.dictionaryTokenAnnotationConfig.video.pitchAccent.onHoverEnabled = true;

        const rendered = renderRichTextOntoSubtitles(
            [
                makeSubtitle({
                    text: '語学',
                    tokenization: {
                        tokens: [makeInternalToken({ pos: [0, 2], status: TokenStatus.UNKNOWN, pitchAccent: 1 })],
                    },
                }),
            ],
            'video',
            makeDictionaryTracks(dt),
            { adaptiveWordVisibilityEnabled: true }
        ).get(0);

        expect(tokenVariant(rendered?.richText, 'base')).toBe('<span data-asb-token-start="0">語学</span>');
        expect(tokenVariant(rendered?.richText, 'cue')).toBe(
            '<span class="asb-token asb-token-highlight" data-asb-token-start="0" style="text-decoration: UNDERLINE #33445566 3px;">語学</span>'
        );
    });

    it.each([
        ['MIU', 'ミウ'],
        ['007', 'ゼロゼロセブン'],
    ])('renders reused subtitle readings for %s even when dictionary readings are disabled', (text, reading) => {
        const rendered = renderToken(
            text,
            makeInternalToken({
                pos: [0, text.length],
                readings: [{ pos: [0, text.length], reading }],
                __usingExternalReadings: true,
            }),
            makeAnnotationTrack({})
        );

        expect(rendered).toBe(`<ruby class="asb-reading">${text}<rt>${reading}</rt></ruby>`);
    });

    it('keeps dictionary-generated numeric readings hidden', () => {
        expect(
            renderToken(
                '007',
                makeInternalToken({ pos: [0, 3], readings: [{ pos: [0, 3], reading: 'ゼロゼロセブン' }] }),
                makeAnnotationTrack({ reading: true })
            )
        ).toBe('007');
    });

    it('keeps coloring on hover for ASCII text without a rendered reading', () => {
        const dt = makeAnnotationTrack({ color: true, reading: true, pitchAccent: true });
        setUnknownTokenColor(dt, '#334455', '66');
        dt.dictionaryTokenAnnotationConfig.video.color.onHoverEnabled = true;
        dt.dictionaryTokenAnnotationConfig.video.pitchAccent.onHoverEnabled = true;

        const rendered = renderRichTextOntoSubtitles(
            [
                makeSubtitle({
                    text: 'RAIN',
                    tokenization: {
                        tokens: [
                            makeInternalToken({
                                pos: [0, 4],
                                status: TokenStatus.UNKNOWN,
                                readings: [{ pos: [0, 4], reading: 'れいん' }],
                                pitchAccent: 1,
                            }),
                        ],
                    },
                }),
            ],
            'video',
            makeDictionaryTracks(dt),
            { adaptiveWordVisibilityEnabled: true }
        ).get(0);

        expect(tokenVariant(rendered?.richText, 'cue')).toBe(
            '<span class="asb-token asb-token-highlight" data-asb-token-start="0" style="text-decoration: UNDERLINE #33445566 3px;">RAIN</span>'
        );
    });

    it('carries pitch accent context onto an attached particle', () => {
        const rendered = computeRichText(
            '日本は',
            {
                tokens: [
                    makeInternalToken({
                        pos: [0, 2],
                        status: TokenStatus.UNKNOWN,
                        readings: [{ pos: [0, 2], reading: 'にほん' }],
                        pitchAccent: 0,
                    }),
                    makeInternalToken({ pos: [2, 3], status: TokenStatus.UNKNOWN }),
                ],
            },
            {
                dt: makeAnnotationTrack({ reading: true, pitchAccent: true }),
                enabledAnnotations: { color: false, reading: true, frequency: false, gloss: false, pitchAccent: true },
                allowAsciiReading: false,
                glossSize: 0.5,
            }
        );

        expect(rendered).toContain('<span class="asb-pitch-accent-mora asb-pitch-accent-mora-high">は</span>');
    });

    it('preserves pitch context when a token reading is hidden', () => {
        const dt = makeAnnotationTrack({ pitchAccent: true });
        dt.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.MATURE].pitchAccent = false;

        expect(
            computeRichText(
                '学校は',
                {
                    tokens: [
                        makeInternalToken({
                            pos: [0, 2],
                            status: TokenStatus.MATURE,
                            readings: [{ pos: [0, 2], reading: 'がっこう' }],
                            pitchAccent: 1,
                        }),
                        makeInternalToken({ pos: [2, 3], status: TokenStatus.UNKNOWN, pitchAccent: null }),
                    ],
                },
                {
                    dt,
                    enabledAnnotations: getAnnotationsForRender(dt, 'video').enabledAnnotations,
                    allowAsciiReading: false,
                    glossSize: getAnnotationsForRender(dt, 'video').glossSize,
                }
            )
        ).toBe(
            '<span data-asb-token-start="0">学校</span>' +
                '<span data-asb-token-start="2"><span class="asb-pitch-accent" style="--asb-pitch-accent-color: currentColor;">' +
                '<span class="asb-pitch-accent-mora asb-pitch-accent-mora-low">は</span></span></span>'
        );
    });

    it('applies token styling when pitch accent is not enabled for the token status', () => {
        const dt = makeAnnotationTrack(
            { color: true, pitchAccent: true },
            { dictionaryTokenStyling: TokenStyling.UNDERLINE }
        );
        dt.dictionaryTokenAnnotationConfig.onStatuses[TokenStatus.UNKNOWN].pitchAccent = false;
        setUnknownTokenColor(dt, '#334455', '66');

        expect(
            renderToken('かな', makeInternalToken({ pos: [0, 2], status: TokenStatus.UNKNOWN, pitchAccent: 1 }), dt)
        ).toBe(
            '<span class="asb-token asb-token-highlight" data-asb-token-start="0" style="text-decoration: UNDERLINE #33445566 3px;">かな</span>'
        );
    });

    describe.each([false, true])('hover per word: %s', (hoverPerToken) => {
        it.each<HoverCase>([
            [
                'color',
                '語学',
                { color: true },
                makeInternalToken({ pos: [0, 2], status: TokenStatus.UNKNOWN }),
                '<span class="asb-token asb-token-highlight" data-asb-token-start="0" style="text-decoration: UNDERLINE #FFA500FF 3px;">語学</span>',
            ],
            [
                'reading',
                '語学',
                { reading: true },
                makeInternalToken({
                    pos: [0, 2],
                    status: TokenStatus.UNKNOWN,
                    readings: [{ pos: [0, 2], reading: 'ごがく' }],
                }),
                '<ruby class="asb-reading">語学<rt>ごがく</rt></ruby>',
            ],
            [
                'frequency',
                '語学',
                { frequency: true },
                makeInternalToken({ pos: [0, 2], status: TokenStatus.UNKNOWN, frequency: 7 }),
                '<ruby class="asb-frequency">語学<rt>7</rt></ruby>',
            ],
            [
                'gloss',
                '語学',
                { gloss: true },
                makeInternalToken({
                    pos: [0, 2],
                    status: TokenStatus.UNKNOWN,
                    gloss: 'definition',
                }),
                '<ruby class="asb-gloss"><ruby class="asb-gloss">語学<rt><span class="asb-gloss-text">ion</span></rt></ruby><rt><span class="asb-gloss-text">definit-</span></rt></ruby>',
            ],
            [
                'pitchAccent',
                'かな',
                { pitchAccent: true },
                makeInternalToken({ pos: [0, 2], status: TokenStatus.UNKNOWN, pitchAccent: 1 }),
                pitchAccentHtml(['か', 'な'], 'currentColor'),
            ],
        ])(
            'renders %s in the requested hover variant for each display target',
            (annotation, text, toggles, token, html) => {
                const dt = makeAnnotationTrack(toggles);
                for (const target of ['video', 'subtitlePlayer'] as const) {
                    dt.dictionaryTokenAnnotationConfig[target][annotation].onHoverEnabled = true;
                    dt.dictionaryTokenAnnotationConfig[target][annotation].hoverPerToken = hoverPerToken;
                    const rendered = renderRichTextOntoSubtitles(
                        [makeSubtitle({ text, tokenization: { tokens: [token] } })],
                        target,
                        makeDictionaryTracks(dt),
                        { adaptiveWordVisibilityEnabled: true }
                    ).get(0);

                    expect(tokenVariant(rendered?.richText, 'base')).toBe(
                        '<span data-asb-token-start="0">' + text + '</span>'
                    );
                    expect(tokenVariant(rendered?.richText, hoverPerToken ? 'word' : 'cue')).toBe(
                        toggles.color ? html : `<span data-asb-token-start="0">${html}</span>`
                    );
                    if (hoverPerToken) expect(rendered?.richText).not.toContain(ASB_TOKEN_ON_CUE_HOVER_CLASS);
                }
            }
        );
    });

    it.each(['video', 'subtitlePlayer'] as const)('combines cue-wide readings and per-word glosses in %s', (target) => {
        const dt = makeAnnotationTrack({ reading: true, gloss: true, frequency: true });
        const config = dt.dictionaryTokenAnnotationConfig[target];
        config.reading.onHoverEnabled = true;
        config.gloss.onHoverEnabled = true;
        config.gloss.hoverPerToken = true;
        const subtitle = makeSubtitle({
            text: '語学学習',
            tokenization: {
                tokens: [
                    makeInternalToken({
                        pos: [0, 2],
                        readings: [{ pos: [0, 2], reading: 'ごがく' }],
                        gloss: 'language',
                        frequency: 7,
                    }),
                    makeInternalToken({
                        pos: [2, 4],
                        readings: [{ pos: [0, 2], reading: 'がくしゅう' }],
                        gloss: 'study',
                        frequency: 9,
                    }),
                ],
            },
        });
        const root = document.createElement('div');
        root.innerHTML =
            renderRichTextOntoSubtitles([subtitle], target, makeDictionaryTracks(dt), {
                adaptiveWordVisibilityEnabled: true,
            }).get(0)?.richText ?? '';
        const tokens = root.querySelectorAll(`.${ASB_TOKEN_HOVER_CLASS}`);
        expect(tokens).toHaveLength(2);
        for (const token of tokens) {
            const base = token.querySelector(`.${ASB_TOKEN_BASE_CLASS}`);
            const cue = token.querySelector(`.${ASB_TOKEN_ON_CUE_HOVER_CLASS}`);
            const word = token.querySelector(`.${ASB_TOKEN_ON_WORD_HOVER_CLASS}`);
            expect(base?.querySelector('.asb-frequency')).not.toBeNull();
            expect(base?.querySelector('.asb-reading')).toBeNull();
            expect(base?.querySelector('.asb-gloss')).toBeNull();
            expect(cue?.querySelector('.asb-reading')).not.toBeNull();
            expect(cue?.querySelector('.asb-gloss')).toBeNull();
            expect(word?.querySelector('.asb-reading')).not.toBeNull();
            expect(word?.querySelector('.asb-frequency')).not.toBeNull();
            expect(word?.querySelector('.asb-gloss')).not.toBeNull();
        }
        expect(root.querySelector('.asb-token')).toBeNull();
    });

    it('preserves attached-particle pitch across per-word variants and invalidates cached hover modes', () => {
        const dt = makeAnnotationTrack({ pitchAccent: true });
        const config = dt.dictionaryTokenAnnotationConfig.video;
        config.pitchAccent.onHoverEnabled = true;
        const subtitle = makeSubtitle({
            text: '学校は',
            tokenization: {
                tokens: [
                    makeInternalToken({
                        pos: [0, 2],
                        readings: [{ pos: [0, 2], reading: 'がっこう' }],
                        pitchAccent: 1,
                    }),
                    makeInternalToken({ pos: [2, 3], pitchAccent: null }),
                ],
            },
        });
        const tracks = makeDictionaryTracks(dt);
        const window = renderRichTextWindow(emptyRichTextWindow(), [subtitle], 'video', tracks);
        const previousHtml = window.buffer.get(0)?.richText;
        const updated = makeAnnotationTrack({ pitchAccent: true });
        updated.dictionaryTokenAnnotationConfig.video.pitchAccent.onHoverEnabled = true;
        updated.dictionaryTokenAnnotationConfig.video.pitchAccent.hoverPerToken = true;
        const rendered = renderRichTextForSubtitle(window, subtitle, 'video', makeDictionaryTracks(updated));
        expect(rendered?.richText).not.toBe(previousHtml);
        const root = document.createElement('div');
        root.innerHTML = rendered?.richText ?? '';
        const particle = root.querySelector(`.${ASB_TOKEN_ON_WORD_HOVER_CLASS} [data-asb-token-start="2"]`);
        expect(particle?.querySelector('.asb-pitch-accent-mora-low')?.textContent).toBe('は');
        expect(root.querySelector(`.${ASB_TOKEN_ON_CUE_HOVER_CLASS}`)).toBeNull();
    });

    it('uses the selected annotation target when splitting hover and non-hover rich text', () => {
        const dt = makeAnnotationTrack({ reading: true });
        dt.dictionaryTokenAnnotationConfig.video.reading.onHoverEnabled = true;
        dt.dictionaryTokenAnnotationConfig.subtitlePlayer.reading.onHoverEnabled = false;
        const subtitle = makeSubtitle({
            text: '語学',
            tokenization: {
                tokens: [
                    makeInternalToken({
                        pos: [0, 2],
                        status: TokenStatus.UNKNOWN,
                        readings: [{ pos: [0, 2], reading: 'ごがく' }],
                    }),
                ],
            },
        });

        const videoRendered = renderRichTextOntoSubtitles([subtitle], 'video', makeDictionaryTracks(dt), {
            adaptiveWordVisibilityEnabled: true,
        }).get(0);
        const subtitlePlayerRendered = renderRichTextOntoSubtitles(
            [subtitle],
            'subtitlePlayer',
            makeDictionaryTracks(dt),
            { adaptiveWordVisibilityEnabled: true }
        ).get(0);

        expect(tokenVariant(videoRendered?.richText, 'base')).toBe('<span data-asb-token-start="0">語学</span>');
        expect(tokenVariant(videoRendered?.richText, 'cue')).toBe(
            '<span data-asb-token-start="0"><ruby class="asb-reading">語学<rt>ごがく</rt></ruby></span>'
        );
        expect(subtitlePlayerRendered?.richText).toBe(
            '<span data-asb-token-start="0"><ruby class="asb-reading">語学<rt>ごがく</rt></ruby></span>'
        );
        expect(subtitlePlayerRendered?.richText).not.toContain(ASB_TOKEN_HOVER_CLASS);
    });

    it('exposes target-specific annotation sizes as CSS custom properties', () => {
        const dt = makeDictionaryTrack();
        dt.dictionaryTokenAnnotationConfig.video.reading.size = 0.75;
        dt.dictionaryTokenAnnotationConfig.video.frequency.size = 0.25;
        dt.dictionaryTokenAnnotationConfig.video.gloss.size = 0.6;
        dt.dictionaryTokenAnnotationConfig.video.pitchAccent.size = 0.125;
        dt.dictionaryTokenAnnotationConfig.subtitlePlayer.reading.size = 0.9;
        dt.dictionaryTokenAnnotationConfig.subtitlePlayer.frequency.size = 0.4;
        dt.dictionaryTokenAnnotationConfig.subtitlePlayer.gloss.size = 0.7;
        dt.dictionaryTokenAnnotationConfig.subtitlePlayer.pitchAccent.size = 0.2;

        expect(tokenAnnotationStyleValues(dt.dictionaryTokenAnnotationConfig.video)).toEqual({
            '--asb-reading-size': '0.75em',
            '--asb-frequency-size': '0.25em',
            '--asb-gloss-size': '0.6em',
            '--asb-pitch-accent-size': '0.125em',
        });
        expect(tokenAnnotationStyleValues(dt.dictionaryTokenAnnotationConfig.subtitlePlayer)).toEqual({
            '--asb-reading-size': '0.9em',
            '--asb-frequency-size': '0.4em',
            '--asb-gloss-size': '0.7em',
            '--asb-pitch-accent-size': '0.2em',
        });
    });

    it('leaves non-letter token text unstyled', () => {
        expect(
            renderToken(
                '。',
                makeToken({ pos: [0, 1], status: TokenStatus.UNKNOWN }),
                makeDictionaryTrack({ dictionaryColorizeSubtitles: true })
            )
        ).toBe('。');
    });

    it('reuses cached entries at both rich text window boundaries', () => {
        const dictionaryTracks = makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true }));
        const first = makeSubtitle({
            index: 0,
            text: '語',
            tokenization: { tokens: [makeToken({ pos: [0, 1], status: TokenStatus.UNKNOWN })] },
        });
        const second = makeSubtitle({
            index: 1,
            text: '学',
            tokenization: { tokens: [makeToken({ pos: [0, 1], status: TokenStatus.UNKNOWN })] },
        });
        const previous = renderRichTextWindow(emptyRichTextWindow(), [first, second], 'video', dictionaryTracks);

        const reused = renderRichTextWindow(previous, [first, second], 'video', dictionaryTracks);

        expect(reused.buffer.get(first.index)).toBe(previous.buffer.get(first.index));
        expect(reused.buffer.get(second.index)).toBe(previous.buffer.get(second.index));
    });

    it('reuses per-subtitle cache entries while refreshing stale entries', () => {
        const dictionaryTracks = makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true }));
        const subtitle = makeSubtitle({
            text: '語学',
            tokenization: { tokens: [makeToken({ pos: [0, 2], status: TokenStatus.UNKNOWN })] },
        });
        const window = renderRichTextWindow(emptyRichTextWindow(), [subtitle], 'video', dictionaryTracks);

        const cached = renderRichTextForSubtitle(window, subtitle, 'video', dictionaryTracks);
        expect(cached?.richText).toContain('語学');
        expect(renderRichTextForSubtitle(window, subtitle, 'video', dictionaryTracks)).toBe(cached);

        const changedSubtitle = makeSubtitle({
            text: '語',
            tokenization: { tokens: [makeToken({ pos: [0, 1], status: TokenStatus.UNKNOWN })] },
        });
        const refreshed = renderRichTextForSubtitle(window, changedSubtitle, 'video', dictionaryTracks);

        expect(refreshed).not.toBe(cached);
        expect(refreshed?.richText).toContain('語</span>');
    });
});
