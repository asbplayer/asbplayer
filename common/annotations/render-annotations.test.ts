import { describe, expect, it } from '@jest/globals';
import {
    type DictionaryTrack,
    TokenFrequencyAnnotation,
    TokenReadingAnnotation,
    TokenStatus,
    TokenStyling,
    tokenAnnotationStyleValues,
} from '@project/common/settings';
import {
    computeRichText,
    emptyRichTextWindow,
    getAnnotationsHtml,
    getAnnotationsForRender,
    renderRichTextForSubtitle,
    renderRichTextOntoSubtitles,
    renderRichTextWindow,
} from './render-annotations';
import { makeDictionaryTrack, makeDictionaryTracks, makeSubtitle, makeToken } from './annotations-test-utils';

type AnnotationToggles = {
    color?: boolean;
    reading?: boolean;
    frequency?: boolean;
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
    return computeRichText(
        fullText,
        { tokens: [token] },
        {
            dt,
            enabledAnnotations: annotations.richTextEnabledAnnotations,
            allowAsciiReading,
        }
    );
};

const makeInternalToken = (overrides: Parameters<typeof makeToken>[0] = {}) =>
    ({ ...makeToken(overrides), __internal: true }) as ReturnType<typeof makeToken> & { __internal: true };

const makeAnnotationTrack = (toggles: AnnotationToggles, overrides: Partial<DictionaryTrack> = {}) => {
    const dt = makeDictionaryTrack(overrides);
    dt.dictionaryTokenAnnotationConfig.colorizeEnabled = toggles.color ?? false;
    for (const config of dt.dictionaryTokenAnnotationConfig.onStatuses) {
        config.reading = toggles.reading ?? false;
        config.frequency = toggles.frequency ?? false;
        config.pitchAccent = toggles.pitchAccent ?? false;
    }
    for (const config of dt.dictionaryTokenAnnotationConfig.onStates) {
        config.reading = false;
        config.frequency = false;
        config.pitchAccent = false;
    }
    for (const target of [
        dt.dictionaryTokenAnnotationConfig.video,
        dt.dictionaryTokenAnnotationConfig.subtitlePlayer,
    ]) {
        target.color.onHoverEnabled = false;
        target.reading.onHoverEnabled = false;
        target.frequency.onHoverEnabled = false;
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
    if (!color) return tokenText;
    if (pitchAccent && reading) return `<span class="asb-token asb-token-highlight">${tokenText}</span>`;
    return `<span class="asb-token asb-token-highlight" style="text-decoration: UNDERLINE ${colorValue} 3px;">${tokenText}</span>`;
};

const annotationCombinations: Required<AnnotationToggles>[] = [];
for (const color of [false, true]) {
    for (const reading of [false, true]) {
        for (const frequency of [false, true]) {
            for (const pitchAccent of [false, true]) {
                annotationCombinations.push({ color, reading, frequency, pitchAccent });
            }
        }
    }
}

describe('rich text rendering', () => {
    it('selects plain, rich, and hover-rich subtitle HTML without dropping fallback text', () => {
        expect(getAnnotationsHtml('plain', undefined, undefined)).toBe('plain');
        expect(getAnnotationsHtml('plain', '<b>rich</b>', undefined)).toBe('<b>rich</b>');
        expect(getAnnotationsHtml('plain', undefined, '<i>hover</i>')).toBe(
            '<span class="asbplayer-subtitle-text">plain</span><span class="asbplayer-subtitle-rich"><i>hover</i></span>'
        );
    });

    it('skips subtitles that cannot be rendered and rejects incomplete track configuration', () => {
        const tracks = makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true }));
        const withoutTokenization = makeSubtitle({ tokenization: undefined });

        expect(renderRichTextOntoSubtitles([withoutTokenization], 'video', tracks)).toEqual(new Map());
        expect(renderRichTextOntoSubtitles([makeSubtitle()], 'video', tracks.slice(0, 1))).toEqual(new Map());
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
            makeDictionaryTracks(makeDictionaryTrack({ dictionaryColorizeSubtitles: true }))
        );

        expect(rendered.get(0)?.richText).toContain('class="asb-token asb-token-highlight"');
        expect(rendered.get(1)?.richText).toBe('<span style="text-decoration: line-through red 3px;">broken</span>');
    });

    it('renders null token statuses with error styling', () => {
        expect(renderToken('語学', makeToken({ pos: [0, 2], status: null }))).toBe(
            '<span style="text-decoration: line-through red 3px;">語学</span>'
        );
    });

    it('separates hover-only annotations into richTextOnHover', () => {
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
            )
        );

        expect(rendered.get(0)?.richText).toBeUndefined();
        expect(rendered.get(0)?.richTextOnHover).toContain('asb-token');
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
                pitchAccent: 1,
            }),
            dt
        );

        expect(rendered).toBe(expectedAnnotationCombinationHtml(toggles));
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
            `<span class="asb-token" style="${expectedStyle}">語学</span>`
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
        ).toBe(`<span class="asb-token asb-token-highlight">${pitchAccentHtml(['か', 'な'], '#33445566')}</span>`);
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
                enabledAnnotations: { color: false, reading: true, frequency: false, pitchAccent: true },
                allowAsciiReading: false,
            }
        );

        expect(rendered).toContain('<span class="asb-pitch-accent-mora asb-pitch-accent-mora-high">は</span>');
    });

    it.each<HoverCase>([
        [
            'color',
            '語学',
            { color: true },
            makeInternalToken({ pos: [0, 2], status: TokenStatus.UNKNOWN }),
            '<span class="asb-token asb-token-highlight" style="text-decoration: UNDERLINE #FFA500FF 3px;">語学</span>',
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
            'pitchAccent',
            'かな',
            { pitchAccent: true },
            makeInternalToken({ pos: [0, 2], status: TokenStatus.UNKNOWN, pitchAccent: 1 }),
            pitchAccentHtml(['か', 'な'], 'currentColor'),
        ],
    ])(
        'renders %s only in richTextOnHover when its hover setting is enabled',
        (annotation, text, toggles, token, html) => {
            const dt = makeAnnotationTrack(toggles);
            dt.dictionaryTokenAnnotationConfig.video[annotation].onHoverEnabled = true;
            const rendered = renderRichTextOntoSubtitles(
                [makeSubtitle({ text, tokenization: { tokens: [token] } })],
                'video',
                makeDictionaryTracks(dt)
            ).get(0);

            expect(rendered?.richText).toBeUndefined();
            expect(rendered?.richTextOnHover).toBe(html);
        }
    );

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

        const videoRendered = renderRichTextOntoSubtitles([subtitle], 'video', makeDictionaryTracks(dt)).get(0);
        const subtitlePlayerRendered = renderRichTextOntoSubtitles(
            [subtitle],
            'subtitlePlayer',
            makeDictionaryTracks(dt)
        ).get(0);

        expect(videoRendered?.richText).toBeUndefined();
        expect(videoRendered?.richTextOnHover).toBe('<ruby class="asb-reading">語学<rt>ごがく</rt></ruby>');
        expect(subtitlePlayerRendered?.richText).toBe('<ruby class="asb-reading">語学<rt>ごがく</rt></ruby>');
        expect(subtitlePlayerRendered?.richTextOnHover).toBeUndefined();
    });

    it('exposes target-specific annotation sizes as CSS custom properties', () => {
        const dt = makeDictionaryTrack();
        dt.dictionaryTokenAnnotationConfig.video.reading.size = 0.75;
        dt.dictionaryTokenAnnotationConfig.video.frequency.size = 0.25;
        dt.dictionaryTokenAnnotationConfig.video.pitchAccent.size = 0.125;
        dt.dictionaryTokenAnnotationConfig.subtitlePlayer.reading.size = 0.9;
        dt.dictionaryTokenAnnotationConfig.subtitlePlayer.frequency.size = 0.4;
        dt.dictionaryTokenAnnotationConfig.subtitlePlayer.pitchAccent.size = 0.2;

        expect(tokenAnnotationStyleValues(dt.dictionaryTokenAnnotationConfig.video)).toEqual({
            '--asb-reading-size': '0.75em',
            '--asb-frequency-size': '0.25em',
            '--asb-pitch-accent-size': '0.125em',
        });
        expect(tokenAnnotationStyleValues(dt.dictionaryTokenAnnotationConfig.subtitlePlayer)).toEqual({
            '--asb-reading-size': '0.9em',
            '--asb-frequency-size': '0.4em',
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
