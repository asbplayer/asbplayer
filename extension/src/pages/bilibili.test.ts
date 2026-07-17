import { extractBilibiliTracks } from './bilibili';

describe('extractBilibiliTracks', () => {
    it('extracts international SRT and JSON tracks', () => {
        const tracks = extractBilibiliTracks(
            {
                data: {
                    subtitles: [
                        {
                            lang: 'English',
                            lang_key: 'en',
                            srt: { url: '//cdn.example.com/subtitles/english.srt' },
                        },
                        {
                            lang: '日本語',
                            lang_key: 'ja',
                            url: 'https://cdn.example.com/subtitles/japanese.json?token=abc',
                        },
                    ],
                },
            },
            'https://www.bilibili.tv/en/video/123'
        );

        expect(tracks).toEqual([
            {
                label: 'English',
                language: 'en',
                url: 'https://cdn.example.com/subtitles/english.srt',
                extension: 'srt',
            },
            {
                label: '日本語',
                language: 'ja',
                url: 'https://cdn.example.com/subtitles/japanese.json?token=abc',
                extension: 'bbjson',
            },
        ]);
    });

    it('extracts mainland manual and AI subtitle tracks as Bilibili JSON', () => {
        const tracks = extractBilibiliTracks(
            {
                data: {
                    subtitle: {
                        subtitles: [
                            {
                                lan: 'zh-CN',
                                lan_doc: '中文（简体）',
                                subtitle_url: '//aisubtitle.hdslb.com/bfs/subtitle/manual.json',
                                ai_type: 0,
                            },
                            {
                                lan: 'ja-JP',
                                subtitle_url: 'https://aisubtitle.hdslb.com/bfs/ai_subtitle/generated',
                                ai_type: 1,
                            },
                        ],
                    },
                },
            },
            'https://www.bilibili.com/video/BV1sM4y1V7x1/'
        );

        expect(tracks).toEqual([
            {
                label: '中文（简体）',
                language: 'zh-CN',
                url: 'https://aisubtitle.hdslb.com/bfs/subtitle/manual.json',
                extension: 'bbjson',
            },
            {
                label: 'ja-JP',
                language: 'ja-JP',
                url: 'https://aisubtitle.hdslb.com/bfs/ai_subtitle/generated',
                extension: 'bbjson',
            },
        ]);
    });

    it('ignores malformed tracks and unrelated JSON', () => {
        expect(
            extractBilibiliTracks(
                {
                    data: {
                        subtitles: [
                            { lang: 'Missing language key', url: 'https://example.com/one.srt' },
                            { lang: 'Missing URL', lang_key: 'en' },
                        ],
                        subtitle: {
                            subtitles: [
                                { lan: '', lan_doc: 'Empty language', subtitle_url: 'https://example.com/one.json' },
                                { lan: 'en', lan_doc: 'Missing URL' },
                            ],
                        },
                    },
                },
                'https://www.bilibili.com/video/BV1sM4y1V7x1/'
            )
        ).toEqual([]);
        expect(extractBilibiliTracks({ data: { unrelated: true } }, 'https://www.bilibili.com/')).toEqual([]);
    });
});
