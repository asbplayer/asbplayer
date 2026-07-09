import { useEffect, useState } from 'react';
import TextField from '@mui/material/TextField';
import Link from '@mui/material/Link';
import { useTranslation, Trans } from 'react-i18next';
import { Anki } from '../anki';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import Tooltip from './Tooltip';
import TutorialBubble from './TutorialBubble';

interface Props {
    anki: Anki;
    disabled: boolean;
    text: string;
    onText: (text: string) => void;
    wordField: string;
    disableTutorial?: boolean;
    showTutorial?: boolean;
    onConfirmTutorial?: () => void;
}

export default function WordField({
    anki,
    disabled,
    text,
    onText,
    wordField,
    disableTutorial,
    showTutorial,
    onConfirmTutorial,
}: Props) {
    const { t } = useTranslation();
    const [lastSearchedWord, setLastSearchedWord] = useState<string>();
    const [duplicateNotes, setDuplicateNotes] = useState<number[]>([]);
    const [wordTimestamp, setWordTimestamp] = useState<number>(0);

    useEffect(() => {
        setWordTimestamp(Date.now());
    }, [text]);

    useEffect(() => {
        if (!text || !wordField) {
            return;
        }

        const trimmedWord = text.trim();

        if (trimmedWord === '' || trimmedWord === lastSearchedWord) {
            return;
        }

        const timeout = setTimeout(() => {
            void (async () => {
                try {
                    setDuplicateNotes(await anki.findNotesWithWord(trimmedWord));
                    setLastSearchedWord(trimmedWord);
                } catch (e) {
                    console.error(e);
                }
            })();
        }, 500);

        return () => clearTimeout(timeout);
    }, [text, wordTimestamp, lastSearchedWord, anki, wordField]);
    let wordHelperText;

    if (text && text.trim() === lastSearchedWord && wordField) {
        wordHelperText =
            duplicateNotes.length > 0
                ? t('ankiDialog.foundDuplicateNotes', {
                      count: duplicateNotes.length,
                      word: text,
                      field: wordField,
                  })
                : t('ankiDialog.foundNoDuplicateNote', { word: text, field: wordField });
    } else {
        wordHelperText = '';
    }

    return (
        <TutorialBubble
            disabled={disableTutorial}
            placement="bottom"
            text={
                <>
                    <Trans
                        i18nKey="ftue.ankiDialogDefinition"
                        components={[<b key={0}>Definition Field</b>, <b key={1}>Word Field</b>]}
                    />
                    <p />
                    <Trans
                        i18nKey="ftue.ankiDialogDefinitionHint"
                        components={[
                            <Link key={0} href="https://yomitan.wiki/" target="_blank">
                                Yomitan
                            </Link>,
                        ]}
                    />
                </>
            }
            show={showTutorial}
            onConfirm={() => onConfirmTutorial?.()}
        >
            <TextField
                variant="filled"
                color="primary"
                fullWidth
                label={t('ankiDialog.word')}
                value={text}
                onChange={(e) => onText(e.target.value)}
                helperText={wordHelperText}
                slotProps={{
                    input: {
                        endAdornment: (
                            <InputAdornment position="end">
                                <Tooltip title={t('ankiDialog.searchInAnki')}>
                                    <span>
                                        <IconButton
                                            disabled={disabled || !wordField || !text || text.trim() === ''}
                                            onClick={() => anki.findNotesWithWordGui(text.trim())}
                                            edge="end"
                                        >
                                            <SearchIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </InputAdornment>
                        ),
                    },
                }}
            />
        </TutorialBubble>
    );
}
