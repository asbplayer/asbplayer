import { useMemo } from 'react';
import {
    DictionaryTrack,
    SubtitleSettings,
    TextSubtitleSettings,
    textSubtitleSettingsForTrack,
    TokenAnnotationConfigTarget,
    tokenAnnotationStyleValues,
} from '../../settings';
import { computeStyleString, computeStyles } from '../../util';

interface TrackStyles {
    styles: { [key: string]: any };
    styleString: string;
    classes: string;
}

export const useSubtitleStyles = (
    settings: SubtitleSettings,
    trackCount: number,
    dictionaryTracks: DictionaryTrack[],
    tokenAnnotationTarget: TokenAnnotationConfigTarget
) => {
    return useMemo(() => {
        const tracks: TrackStyles[] = [];
        for (let track = 0; track < trackCount; ++track) {
            const s = textSubtitleSettingsForTrack(settings, track) as TextSubtitleSettings;
            const dt = dictionaryTracks[track];
            const annotationStyleValues = tokenAnnotationStyleValues(
                dt.dictionaryTokenAnnotationConfig[tokenAnnotationTarget]
            );
            tracks.push({
                styles: computeStyles(s, annotationStyleValues),
                styleString: computeStyleString(s, annotationStyleValues),
                classes: s.subtitleBlur ? 'asbplayer-subtitles-blurred' : '',
            });
        }
        return tracks;
    }, [settings, trackCount, dictionaryTracks, tokenAnnotationTarget]);
};
