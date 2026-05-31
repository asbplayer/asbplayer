const videoChangeDebounceMs = 1000;

export function createVideoChangeHandler(
    video: HTMLMediaElement,
    onVideoChange: () => void
): () => void {
    let lastVideoSrc: string | undefined = video.src;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    return () => {
        if (video.src === lastVideoSrc) {
            return;
        }
        lastVideoSrc = video.src;
        if (debounceTimer !== undefined) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            debounceTimer = undefined;
            onVideoChange();
        }, videoChangeDebounceMs);
    };
}
