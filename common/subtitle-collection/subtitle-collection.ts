import IntervalTree, { Interval, NumericTuple } from '@flatten-js/interval-tree';
import { SubtitleModel } from '../src/model';

export interface SubtitleSlice<T> {
    showing: T[];
    lastShown?: T[];
    nextToShow?: T[];
    startedShowing?: T;
    willStopShowing?: T;
}

export interface SubtitleCollectionOptions {
    returnLastShown?: boolean;
    returnNextToShow?: boolean;
    showingCheckRadiusMs?: number;
}

export class SubtitleCollection<T extends SubtitleModel> {
    static emptySubtitleCollection = new SubtitleCollection({});

    private options: SubtitleCollectionOptions;
    // Tree for subtitles
    private tree: IntervalTree<T>;
    // Tree for gaps between subtitles. The gaps are populated with the last subtitle before the gap.
    private gapsTree?: IntervalTree<T>;

    constructor(options: SubtitleCollectionOptions) {
        this.options = options;
        this.tree = new IntervalTree<T>();
    }

    setSubtitles(subtitles: T[]) {
        this.tree = new IntervalTree<T>();

        if (this.options.returnLastShown || this.options.returnNextToShow) {
            let last: T | undefined;
            this.gapsTree = new IntervalTree<T>();

            if (subtitles.length > 0 && subtitles[0].start > 0) {
                this.gapsTree.insert([0, subtitles[0].start - 1], subtitles[0]);
            }

            for (const s of subtitles) {
                if (s.start < s.end) {
                    this.tree.insert([s.start, s.end - 1], s);
                }

                if (last !== undefined && last.end < s.start) {
                    this.gapsTree.insert([last.end, s.start - 1], last);
                }

                last = s;
            }
        } else {
            for (const s of subtitles) {
                this.tree.insert([s.start, s.end - 1], s);
            }
        }
    }

    static empty<S extends SubtitleModel>() {
        return SubtitleCollection.emptySubtitleCollection as SubtitleCollection<S>;
    }

    subtitlesAt(timestamp: number): SubtitleSlice<T> {
        const interval: NumericTuple = [timestamp, timestamp];
        const showing = this.tree.search(interval) as T[];
        let lastShown: T[] | undefined;
        let nextToShow: T[] | undefined;
        let startedShowing: T | undefined;
        let willStopShowing: T | undefined;

        if (showing.length === 0) {
            if (this.gapsTree !== undefined) {
                // One of returnLastShown or returnNextToShow is true due to constructor
                const gapIntervals: Interval[] = [];
                lastShown = this.gapsTree.search(interval, (s, i) => {
                    gapIntervals.push(i);
                    return s;
                }) as T[];

                if (lastShown.length > 0 && this.options.returnNextToShow) {
                    const nextStart = gapIntervals[0].high + 1;
                    nextToShow = this.tree.search([nextStart, nextStart]) as T[];
                }
            }
        } else if (this.options.showingCheckRadiusMs !== undefined) {
            for (const s of showing) {
                if (willStopShowing === undefined && s.end <= timestamp + this.options.showingCheckRadiusMs) {
                    willStopShowing = s;
                }

                if (startedShowing === undefined && timestamp - this.options.showingCheckRadiusMs < s.start) {
                    startedShowing = s;
                }

                if (startedShowing !== undefined && willStopShowing !== undefined) {
                    break;
                }
            }
        }

        return { showing, lastShown, nextToShow, startedShowing, willStopShowing };
    }
}
