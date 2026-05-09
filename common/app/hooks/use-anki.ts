import { Fetcher } from '../..';
import { Anki } from '../../anki';
import { AnkiSettings } from '../../settings';
import { useMemo } from 'react';

class SettingsAccessor {
    settings!: AnkiSettings;

    get ankiConnectUrl() {
        return this.settings.ankiConnectUrl;
    }
    get deck() {
        return this.settings.deck;
    }
    get noteType() {
        return this.settings.noteType;
    }
    get sentenceField() {
        return this.settings.sentenceField;
    }
    get definitionField() {
        return this.settings.definitionField;
    }
    get audioField() {
        return this.settings.audioField;
    }
    get imageField() {
        return this.settings.imageField;
    }
    get wordField() {
        return this.settings.wordField;
    }
    get sourceField() {
        return this.settings.sourceField;
    }
    get urlField() {
        return this.settings.urlField;
    }

    get track1Field() {
        return this.settings.track1Field;
    }

    get track2Field() {
        return this.settings.track2Field;
    }

    get track3Field() {
        return this.settings.track3Field;
    }

    get ankiFieldSettings() {
        return this.settings.ankiFieldSettings;
    }

    get customAnkiFields() {
        return this.settings.customAnkiFields;
    }

    get customAnkiFieldSettings() {
        return this.settings.customAnkiFieldSettings;
    }

    get tags() {
        return this.settings.tags;
    }
    get preferMp3() {
        return this.settings.preferMp3;
    }
    get audioPaddingStart() {
        return this.settings.audioPaddingStart;
    }
    get audioPaddingEnd() {
        return this.settings.audioPaddingEnd;
    }
    get maxImageWidth() {
        return this.settings.maxImageWidth;
    }
    get maxImageHeight() {
        return this.settings.maxImageHeight;
    }
    get mediaFragmentFormat() {
        return this.settings.mediaFragmentFormat;
    }
    get mediaFragmentTrimStart() {
        return this.settings.mediaFragmentTrimStart;
    }
    get mediaFragmentTrimEnd() {
        return this.settings.mediaFragmentTrimEnd;
    }
    get mediaFragmentMaxClipLength() {
        return this.settings.mediaFragmentMaxClipLength;
    }
    get surroundingSubtitlesCountRadius() {
        return this.settings.surroundingSubtitlesCountRadius;
    }
    get surroundingSubtitlesTimeRadius() {
        return this.settings.surroundingSubtitlesTimeRadius;
    }
    get recordWithAudioPlayback() {
        return this.settings.recordWithAudioPlayback;
    }
}

const settingsAccessor = new SettingsAccessor();

// Avoid unnecessary re-renders caused from reconstructing Anki by having Anki access settings indirectly
export const useAnki = ({ settings, fetcher }: { settings: AnkiSettings; fetcher: Fetcher }) => {
    settingsAccessor.settings = settings;
    return useMemo(() => {
        return new Anki(settingsAccessor, fetcher);
    }, [fetcher]);
};
