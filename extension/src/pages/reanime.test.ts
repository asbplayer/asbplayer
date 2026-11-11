import { describe, expect, it, jest } from '@jest/globals';

// The package ships ESM that this repository's Jest setup does not transform.
jest.mock('@project/common/subtitle-reader/subtitles-to-srt', () => ({ subtitlesToSrt: () => '' }));

import { reanimeTracksFromScript } from '@project/extension/src/pages/reanime';

describe('reanimeTracksFromScript', () => {
    it('extracts subtitles from the flixcloud hydration literal', () => {
        const base = 'https://vault-93.phantomcdn.top/subtitles/abc/abc';
        const script = `kit.start(app,el,{data:[{video_title:"x",subtitles:[{url:"${base}_jpn_2.ass",language:"Japanese (Full Subtitles [CR])",format:"ass",default:false},{url:"${base}_eng_5.ass",language:"English (Signs \\u0026 Songs)",format:"ass",default:true},{url:"${base}.srt",language:"English (Dubtitle(AI))",format:"srt",default:true}],other:1}]})`;

        expect(reanimeTracksFromScript(script)).toEqual([
            expect.objectContaining({
                label: 'Japanese (Full Subtitles [CR])',
                language: 'ja',
                url: `${base}_jpn_2.ass`,
                extension: 'ass',
            }),
            expect.objectContaining({ label: 'English (Signs & Songs)', language: 'en', extension: 'ass' }),
            expect.objectContaining({ label: 'English (Dubtitle(AI))', language: undefined, extension: 'srt' }),
        ]);
    });

    it('ignores scripts without a subtitle list', () => {
        expect(reanimeTracksFromScript('console.log({url:"a"})')).toEqual([]);
    });
});
