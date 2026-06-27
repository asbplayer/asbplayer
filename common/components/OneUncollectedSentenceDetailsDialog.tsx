import { useTranslation } from 'react-i18next';
import { useCallback, type ComponentProps } from 'react';

import StatisticsSentenceDetailsDialog from './StatisticsSentenceDetailsDialog';
import { type DictionaryProvider } from '../dictionary-db';
import { type DictionaryStatisticsSentence } from '../dictionary-statistics';

interface Props
    extends Omit<
        ComponentProps<typeof StatisticsSentenceDetailsDialog>,
        'title' | 'subtitles' | 'onMineSentence' | 'onSeekToSentence'
    > {
    dictionaryProvider: DictionaryProvider;
    mediaId?: string;
}

const OneUncollectedSentenceDetailsDialog: React.FC<Props> = ({ dictionaryProvider, mediaId, ...rest }) => {
    const { t } = useTranslation();
    const iPlusOneLabel = `1 ${t('settings.dictionaryTokenStatus0')}`;

    const handleSeekToSentence = useCallback(
        (sentence: DictionaryStatisticsSentence) => {
            if (!mediaId) {
                return;
            }
            dictionaryProvider.requestStatisticsSeek(mediaId, sentence.start);
        },
        [mediaId, dictionaryProvider]
    );
    const handleMineSentence = useCallback(
        (sentence: DictionaryStatisticsSentence) => {
            if (!mediaId) {
                return;
            }
            dictionaryProvider.requestStatisticsMineSentences(mediaId, [sentence.index]);
        },
        [mediaId, dictionaryProvider]
    );

    return (
        <StatisticsSentenceDetailsDialog
            title={iPlusOneLabel}
            subtitles={[iPlusOneLabel]}
            onMineSentence={handleMineSentence}
            onSeekToSentence={handleSeekToSentence}
            {...rest}
        />
    );
};

export default OneUncollectedSentenceDetailsDialog;
