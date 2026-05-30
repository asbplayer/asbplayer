import { createVideoChangeHandler } from './video-change-handler';

describe('createVideoChangeHandler', () => {
    let video: HTMLVideoElement;
    let onVideoChange: jest.Mock;
    let handler: () => void;

    beforeEach(() => {
        jest.useFakeTimers();
        video = document.createElement('video');
        Object.defineProperty(video, 'src', { value: 'https://cdn.example.com/stream1.mpd', writable: true });
        onVideoChange = jest.fn();
        handler = createVideoChangeHandler(video, onVideoChange);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('does not call onVideoChange when video.src has not changed', () => {
        handler();
        jest.advanceTimersByTime(2000);
        expect(onVideoChange).not.toHaveBeenCalled();
    });

    it('does not call onVideoChange when video.src has not changed across multiple firings', () => {
        handler();
        handler();
        handler();
        jest.advanceTimersByTime(2000);
        expect(onVideoChange).not.toHaveBeenCalled();
    });

    it('calls onVideoChange after debounce when video.src changes', () => {
        (video as any).src = 'https://cdn.example.com/stream2.mpd';
        handler();
        expect(onVideoChange).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1000);
        expect(onVideoChange).toHaveBeenCalledTimes(1);
    });

    it('debounces rapid src changes to a single call', () => {
        (video as any).src = 'https://cdn.example.com/stream2.mpd';
        handler();
        jest.advanceTimersByTime(500);

        (video as any).src = 'https://cdn.example.com/stream3.mpd';
        handler();
        jest.advanceTimersByTime(500);

        // First timer was cleared, only 500ms since last change
        expect(onVideoChange).not.toHaveBeenCalled();

        jest.advanceTimersByTime(500);
        expect(onVideoChange).toHaveBeenCalledTimes(1);
    });

    it('ignores loadedmetadata firings after src change settles', () => {
        (video as any).src = 'https://cdn.example.com/stream2.mpd';
        handler();
        jest.advanceTimersByTime(1000);
        expect(onVideoChange).toHaveBeenCalledTimes(1);

        // Same src, should be ignored
        handler();
        handler();
        jest.advanceTimersByTime(2000);
        expect(onVideoChange).toHaveBeenCalledTimes(1);
    });

    it('handles multiple distinct src changes over time', () => {
        (video as any).src = 'https://cdn.example.com/stream2.mpd';
        handler();
        jest.advanceTimersByTime(1000);
        expect(onVideoChange).toHaveBeenCalledTimes(1);

        (video as any).src = 'https://cdn.example.com/stream3.mpd';
        handler();
        jest.advanceTimersByTime(1000);
        expect(onVideoChange).toHaveBeenCalledTimes(2);
    });
});
