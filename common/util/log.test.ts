import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { asbError, asbInfo, asbLog, asbWarn } from '@project/common/util';

afterEach(() => {
    jest.restoreAllMocks();
});

describe('asb logging', () => {
    it('prepends the default label while preserving all message arguments', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const details = { durationMs: 10 };

        asbLog('message', details);

        expect(log).toHaveBeenCalledWith('[asbplayer]', 'message', details);
    });

    it('supports a trailing label option', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const error = new Error('failed');

        asbWarn('message', error, { asbLogLabel: 'playback/timing' });

        expect(warn).toHaveBeenCalledWith('[asbplayer][playback/timing]', 'message', error);
    });

    it('preserves informational logging', () => {
        const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

        asbInfo('message', { asbLogLabel: 'media-fragment' });

        expect(info).toHaveBeenCalledWith('[asbplayer][media-fragment]', 'message');
    });

    it('supports a leading label option', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const error = new Error('failed');

        asbError({ asbLogLabel: 'yomitan/mecab' }, error);

        expect(errorSpy).toHaveBeenCalledWith('[asbplayer][yomitan/mecab]', error);
    });
});
