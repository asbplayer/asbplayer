import { MutableRefObject, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type ListRange, type TableVirtuosoHandle } from 'react-virtuoso';
import { type DictionaryTrack, dictionaryTrackEnabled } from '@project/common/settings';
import { normalizedLookupTerms, normalizeSearchText } from '@project/common/util';
import { Yomitan } from '@project/common/yomitan';
import { type DisplaySubtitleModel } from '../components/SubtitlePlayer';

const findDelayMs = 300;

const parseRegexQuery = (query: string): RegExp | undefined => {
    const regexMatch = /^\/(.+)\/([a-z]*)$/.exec(query);
    if (!regexMatch) return;
    try {
        return new RegExp(regexMatch[1], regexMatch[2].replace(/[gy]/g, ''));
    } catch (e) {
        return;
    }
};

const subtitleSearchableText = (subtitle: DisplaySubtitleModel): string => {
    const tokens = subtitle.tokenization?.tokens;
    if (!tokens?.length) return subtitle.text;
    let readings = '';
    for (const token of tokens) {
        for (const reading of token.readings) {
            if (reading.reading) readings += reading.reading;
        }
    }
    return readings.length ? `${subtitle.text}\n${readings}` : subtitle.text;
};

interface UseSubtitleFindParams {
    subtitles?: DisplaySubtitleModel[];
    dictionaryTracks: DictionaryTrack[];
    disableKeyEventsRef: MutableRefObject<boolean>;
    hiddenRef: MutableRefObject<boolean>;
    lastScrollTimestampRef: MutableRefObject<number>;
    subtitleListRef: MutableRefObject<DisplaySubtitleModel[] | undefined>;
    virtuosoRef: RefObject<TableVirtuosoHandle | null>;
    visibleRangeRef: MutableRefObject<ListRange>;
    setHighlightedJumpToSubtitleIndex: (index: number | undefined) => void;
}

export const useSubtitleFind = ({
    subtitles,
    dictionaryTracks,
    disableKeyEventsRef,
    hiddenRef,
    lastScrollTimestampRef,
    subtitleListRef,
    virtuosoRef,
    visibleRangeRef,
    setHighlightedJumpToSubtitleIndex,
}: UseSubtitleFindParams) => {
    const [open, setOpen] = useState<boolean>(false);
    const [query, setQuery] = useState<string>('');
    const [expansion, setExpansion] = useState<{ query: string; terms: string[] }>({ query: '', terms: [] });
    const [currentMatchPosition, setCurrentMatchPosition] = useState<number>(0);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const yomitans = useMemo(
        () =>
            dictionaryTracks
                .filter((dictionaryTrack) => dictionaryTrackEnabled(dictionaryTrack))
                .map((dictionaryTrack) => new Yomitan(dictionaryTrack)),
        [dictionaryTracks]
    );
    const yomitanVersionPromisesRef = useRef<WeakMap<Yomitan, Promise<unknown>>>(new WeakMap());
    const ensureYomitanVersion = useCallback(async () => {
        await Promise.allSettled(
            yomitans.map((yomitan) => {
                const cached = yomitanVersionPromisesRef.current.get(yomitan);
                if (cached) return cached;
                const promise = yomitan.version().catch((e) => {
                    yomitanVersionPromisesRef.current.delete(yomitan);
                    throw e;
                });
                yomitanVersionPromisesRef.current.set(yomitan, promise);
                return promise;
            })
        );
    }, [yomitans]);

    useEffect(() => {
        const trimmed = query.trim();
        if (!open || !trimmed || parseRegexQuery(query) !== undefined || !yomitans.length) return;

        let cancelled = false;
        const timeout = setTimeout(async () => {
            await ensureYomitanVersion();
            if (cancelled) return;
            const queryForms = new Set<string>([trimmed]);

            const tokenizeResults = await Promise.allSettled(
                yomitans.map((yt) => {
                    try {
                        return yt.tokenize(trimmed);
                    } catch (e) {
                        yomitanVersionPromisesRef.current.delete(yt);
                        throw e;
                    }
                })
            );
            for (const result of tokenizeResults) {
                if (result.status !== 'fulfilled') continue;
                for (const tokenParts of result.value) {
                    const tokenText = tokenParts
                        .map((part) => part.text)
                        .join('')
                        .trim();
                    if (tokenText) queryForms.add(tokenText);
                }
            }

            const lemmaTerms = new Set<string>();
            for (const queryForm of queryForms) {
                const lemmaResults = await Promise.allSettled(
                    yomitans.map((yt) => {
                        try {
                            return yt.lemmatize(queryForm);
                        } catch (e) {
                            yomitanVersionPromisesRef.current.delete(yt);
                            throw e;
                        }
                    })
                );
                for (const result of lemmaResults) {
                    if (result.status !== 'fulfilled') continue;
                    for (const lemma of result.value ?? []) lemmaTerms.add(lemma);
                }
            }

            if (cancelled) return;
            setExpansion({ query: trimmed, terms: normalizedLookupTerms(...queryForms, ...lemmaTerms) });
        }, findDelayMs);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [query, open, yomitans, ensureYomitanVersion]);

    const matches = useMemo(() => {
        const trimmed = query.trim();
        if (!open || !subtitles || !subtitles.length || !trimmed) return [];

        const matches: number[] = [];
        const regex = parseRegexQuery(query);
        if (regex) {
            for (const [i, subtitle] of subtitles.entries()) {
                const searchableText = subtitleSearchableText(subtitle);
                if (regex.test(searchableText)) matches.push(i);
            }
        } else {
            const terms = normalizedLookupTerms(trimmed).concat(expansion.query === trimmed ? expansion.terms : []);
            for (const [i, subtitle] of subtitles.entries()) {
                const normalized = normalizeSearchText(subtitleSearchableText(subtitle));
                if (terms.some((term) => normalized.includes(term))) matches.push(i);
            }
        }
        return matches;
    }, [open, subtitles, query, expansion]);
    const matchesRef = useRef(matches);
    matchesRef.current = matches;

    const scrollToMatch = useCallback(
        (subtitleIndex: number) => {
            lastScrollTimestampRef.current = Date.now();
            if (!hiddenRef.current) {
                virtuosoRef.current?.scrollToIndex({
                    index: subtitleIndex,
                    align: 'center',
                    behavior: 'auto',
                });
            }
            setHighlightedJumpToSubtitleIndex(subtitleIndex);
        },
        [hiddenRef, lastScrollTimestampRef, setHighlightedJumpToSubtitleIndex, virtuosoRef]
    );

    useEffect(() => {
        if (!open) return;
        const trimmed = query.trim();
        const searchCompleted =
            !trimmed || parseRegexQuery(query) !== undefined || !yomitans.length || expansion.query === trimmed;
        if (!searchCompleted) return;
        if (!matches.length) {
            setHighlightedJumpToSubtitleIndex(undefined);
            setCurrentMatchPosition(0);
            return;
        }
        const firstVisibleIndex = visibleRangeRef.current.startIndex;
        const matchPosition = Math.max(
            0,
            matches.findIndex((subtitleIndex) => subtitleIndex >= firstVisibleIndex)
        );
        setCurrentMatchPosition(matchPosition);
        scrollToMatch(matches[matchPosition]);
    }, [
        matches,
        open,
        query,
        expansion.query,
        yomitans.length,
        scrollToMatch,
        setHighlightedJumpToSubtitleIndex,
        visibleRangeRef,
    ]);

    const navigate = useCallback(
        (delta: number) => {
            const matches = matchesRef.current;
            if (!matches.length) return;
            setCurrentMatchPosition((current) => {
                const next = (current + delta + matches.length) % matches.length;
                scrollToMatch(matches[next]);
                return next;
            });
        },
        [scrollToMatch]
    );

    const next = useCallback(() => navigate(1), [navigate]);
    const previous = useCallback(() => navigate(-1), [navigate]);

    const close = useCallback(() => {
        setOpen(false);
        setQuery('');
        setCurrentMatchPosition(0);
        setHighlightedJumpToSubtitleIndex(undefined);
    }, [setHighlightedJumpToSubtitleIndex]);

    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key === 'f' || event.key === 'F')) {
                if (disableKeyEventsRef.current || !subtitleListRef.current || !subtitleListRef.current.length) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                setOpen(true);
                requestAnimationFrame(() => {
                    inputRef.current?.focus();
                    inputRef.current?.select();
                });
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown, true);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown, true);
    }, [disableKeyEventsRef, subtitleListRef]);

    const resultsLabel = query.trim() ? `${matches.length ? currentMatchPosition + 1 : 0}/${matches.length}` : '';

    return {
        open,
        query,
        inputRef,
        matches,
        resultsLabel,
        setQuery,
        next,
        previous,
        close,
    };
};
