import { defaultSettings } from '@project/common/settings';
import pagesConfig from '../pages.json';
import { expect, it } from '@jest/globals';

it('page settings and page configs are consistent', () => {
    for (const page of pagesConfig.pages) {
        expect(page.key in defaultSettings.streamingPages).toBe(true);
    }

    for (const key of Object.keys(defaultSettings.streamingPages)) {
        expect(pagesConfig.pages.find((p) => p.key === key) !== undefined).toBe(true);
    }
});
