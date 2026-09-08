import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { asbError, asbInfo, asbLog, asbWarn } from '@project/common/util';

afterEach(() => {
    jest.restoreAllMocks();
});

describe('asb logging', () => {
    it('prepends the label while preserving all message arguments', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const details = { durationMs: 10 };

        asbLog('playback', 'message', details);

        expect(log).toHaveBeenCalledWith('[asbplayer][playback]', 'message', details);
    });

    it('supports warning logging', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const error = new Error('failed');

        asbWarn('playback/timing', 'message', error);

        expect(warn).toHaveBeenCalledWith('[asbplayer][playback/timing]', 'message', error);
    });

    it('preserves informational logging', () => {
        const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

        asbInfo('media-fragment', 'message');

        expect(info).toHaveBeenCalledWith('[asbplayer][media-fragment]', 'message');
    });

    it('supports error logging', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const error = new Error('failed');

        asbError('yomitan/mecab', error);

        expect(errorSpy).toHaveBeenCalledWith('[asbplayer][yomitan/mecab]', error);
    });
});
