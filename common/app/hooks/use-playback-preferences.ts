import { useMemo } from 'react';
import PlaybackPreferenceController from '@project/common/playback/controllers/playback-preference-controller';

export const usePlaybackPreferences = () => {
    return useMemo(() => new PlaybackPreferenceController(), []);
};
