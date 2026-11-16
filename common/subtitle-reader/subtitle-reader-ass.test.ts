import { describe, expect, it, jest } from '@jest/globals';
import SubtitleReader from '@project/common/subtitle-reader/subtitle-reader';
import { SubtitleHtml } from '@project/common';

// SRT parsing is not exercised here, and the package ships ESM that ts-jest does not transform.
jest.mock('@qgustavor/srt-parser', () => ({ __esModule: true, default: class {} }));

// Uses the real ass-compiler, which subtitle-reader.test.ts mocks out.
const createReader = () =>
    new SubtitleReader({
        regexFilter: '',
        regexFilterTextReplacement: '',
        subtitleHtml: SubtitleHtml.render,
        convertNetflixRuby: false,
        pgsParserWorkerFactory: () => Promise.reject(new Error('PGS worker is not used in these tests')),
    });

describe('ASS typeset signs', () => {
    const assFile = (events: string[]) =>
        ({
            name: 'test.ass',
            text: async () =>
                [
                    '[Script Info]',
                    'ScriptType: v4.00+',
                    'PlayResX: 640',
                    'PlayResY: 360',
                    '',
                    '[V4+ Styles]',
                    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
                    'Style: Default,Arial,24,&H00FFFFFF,&H000019FF,&H00000000,&H6E000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,20,1',
                    '',
                    '[Events]',
                    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
                    ...events,
                ].join('\n'),
        }) as unknown as File;

    it('drops positioned signs with typesetting overrides and keeps dialogue', async () => {
        const subtitles = await createReader().subtitles([
            {
                fileParts: [
                    assFile([
                        String.raw`Dialogue: 0,0:00:01.00,0:00:05.00,Default,SIGN,0,0,0,,{\an8\bord0\fs12\fnGeorgia\c&HBABAA1&\move(264,22,251,22)}Classroom`,
                        String.raw`Dialogue: 0,0:00:01.00,0:00:05.00,Default,SIGN,0,0,0,,{\an1\fs15\frz333\pos(518,292)}Rustle\NRustle`,
                        String.raw`Dialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,{\pos(100,100)\p1}m 0 0 l 10 0 10 10{\p0}`,
                        'Dialogue: 0,0:00:02.00,0:00:04.00,Default,TEACHER,0,0,0,,This is where it starts.',
                        String.raw`Dialogue: 0,0:00:06.00,0:00:08.00,Default,ASHITO,0,0,0,,{\pos(460,247.5)}Look up!`,
                        String.raw`Dialogue: 0,0:00:09.00,0:00:10.00,Default,ASHITO,0,0,0,,{\pos(460,247.5)\i1}Look up again!`,
                        String.raw`Dialogue: 0,0:00:11.00,0:00:12.00,Default,ASHITO,0,0,0,,{\fs30}Loud, but not positioned.`,
                    ]),
                ],
            },
        ]);

        expect(subtitles.map((subtitle) => subtitle.text)).toEqual([
            'This is where it starts.',
            'Look up!',
            'Look up again!',
            'Loud, but not positioned.',
        ]);
    });
});
