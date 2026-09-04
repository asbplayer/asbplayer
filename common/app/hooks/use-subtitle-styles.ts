import { useMemo, useRef } from 'react';
import type {
    DictionaryTrack,
    SubtitleSettings,
    TextSubtitleSettings,
    TokenAnnotationConfigTarget,
} from '@project/common/settings';
import {
    areDictionaryTracksEqual,
    areSubtitleSettingsEqual,
    textSubtitleSettingsForTrack,
    tokenAnnotationStyleValues,
} from '@project/common/settings';
import { computeStyleString, computeStyles } from '@project/common/util';

interface TrackStyles {
    styles: { [key: string]: any };
    styleString: string;
    classes: string;
}

const useStableValue = <T>(value: T, areEqual: (left: T, right: T) => boolean) => {
    const stableValueRef = useRef(value);
    const previousValueRef = useRef(value);

    if (value !== previousValueRef.current) {
        if (!areEqual(stableValueRef.current, value)) stableValueRef.current = value;
        previousValueRef.current = value;
    }

    return stableValueRef.current;
};

export const useStableDictionaryTracks = (dictionaryTracks: DictionaryTrack[]) => {
    return useStableValue(dictionaryTracks, (previous, current) => {
        return (
            previous.length === current.length &&
            current.every((track, index) => areDictionaryTracksEqual(track, previous[index]))
        );
    });
};

export const useStableSubtitleSettings = (settings: SubtitleSettings) => {
    return useStableValue(settings, areSubtitleSettingsEqual);
};

export const useSubtitleStyles = (
    settings: SubtitleSettings,
    trackCount: number,
    dictionaryTracks: DictionaryTrack[],
    tokenAnnotationTarget: TokenAnnotationConfigTarget
) => {
    const stableSettings = useStableSubtitleSettings(settings);

    return useMemo(() => {
        const tracks: TrackStyles[] = [];
        for (let track = 0; track < trackCount; ++track) {
            const s = textSubtitleSettingsForTrack(stableSettings, track) as TextSubtitleSettings;
            const dt = dictionaryTracks[track];
            const annotationStyleValues = tokenAnnotationStyleValues(
                dt.dictionaryTokenAnnotationConfig[tokenAnnotationTarget]
            );
            tracks.push({
                styles: computeStyles(s, annotationStyleValues),
                styleString: computeStyleString(s, annotationStyleValues),
                classes: s.subtitleBlur ? 'asbplayer-subtitles-blurred asb-subtitles' : 'asb-subtitles',
            });
        }
        return tracks;
    }, [stableSettings, trackCount, dictionaryTracks, tokenAnnotationTarget]);
};
