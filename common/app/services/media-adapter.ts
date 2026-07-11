import { RefObject } from 'react';

export interface MediaElement {
    currentTime: number;
    readyState: number;
    playbackRate: number;
    oncanplay: ((ev: Event) => void) | null;
    play: () => Promise<void>;
    pause: () => void;
    duration: number;
}

export default class MediaAdapter {
    private readonly ref: RefObject<MediaElement | undefined>;
    private readonly readyResolves: (() => void)[];

    constructor(ref: RefObject<MediaElement | undefined>) {
        this.ref = ref;
        this.readyResolves = [];
    }

    async seek(time: number) {
        return new Promise((resolve) => {
            if (this.ref.current) {
                this.ref.current.currentTime = time;
                this._onMediaCanPlay(() => resolve(undefined));
            } else {
                resolve(undefined);
            }
        });
    }

    async onReady() {
        return new Promise((resolve) => {
            if (this.ref.current) {
                this._onMediaCanPlay(() => resolve(undefined));
            } else {
                resolve(undefined);
            }
        });
    }

    _onMediaCanPlay(callback: () => void) {
        if (this.ref.current?.readyState === 4) {
            callback();
            return;
        }

        if (this.ref.current && !this.ref.current.oncanplay) {
            this.ref.current.oncanplay = () => {
                for (const resolve of this.readyResolves) {
                    resolve();
                }

                this.readyResolves.length = 0;

                if (this.ref.current) {
                    this.ref.current.oncanplay = null;
                }
            };
        }

        this.readyResolves.push(callback);
    }

    play() {
        void this.ref.current?.play();
    }

    pause() {
        this.ref.current?.pause();
    }

    playbackRate(playbackRate: number) {
        if (this.ref.current) {
            this.ref.current.playbackRate = playbackRate;
        }
    }
}
