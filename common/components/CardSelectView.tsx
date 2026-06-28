import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import { Anki, NoteInfo } from '@project/common/anki';
import { AnkiSettings } from '../settings';
import Dialog from '@mui/material/Dialog';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import ListItem from '@mui/material/ListItem';
import Tooltip from '@mui/material/Tooltip';
import { type ButtonBaseActions } from '@mui/material';

interface Props {
    open: boolean;
    anki: Anki;
    ankiSettings: AnkiSettings;
    selectedNoteIds: number[];
    disabled?: boolean;
    onUpdate: (noteIds: number[]) => Promise<void> | void;
    onSelect: (noteIds: number[]) => Promise<void> | void;
    onClose: () => void;
}

const maxNoteCount = 50;

const useSearchAnki = ({ anki, querier }: { anki: Anki; querier: (anki: Anki) => Promise<number[]> }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();
    const [notes, setNotes] = useState<NoteInfo[]>([]);
    const searchRequestId = useRef<number>(0);

    const search = useCallback(async () => {
        try {
            searchRequestId.current++;
            const requestId = searchRequestId.current;
            setLoading(true);

            if (searchRequestId.current !== requestId) {
                return;
            }

            const noteIds = await querier(anki);

            if (searchRequestId.current !== requestId) {
                return;
            }

            const sortedNoteIds = [...noteIds].sort((a, b) => b - a).slice(0, maxNoteCount);
            const noteInfos = await anki.notesInfo(sortedNoteIds);

            if (searchRequestId.current !== requestId) {
                return;
            }

            setNotes(noteInfos);
        } catch (e) {
            setError(error);
        } finally {
            setLoading(false);
        }
    }, [querier, error, anki]);

    // Search at least once to provide initial list
    const searchRef = useRef<typeof search>(search);
    useEffect(() => {
        searchRef.current();
    }, []);

    return { notes, error, loading, search };
};

export default function CardSelectView({
    open,
    anki,
    ankiSettings,
    disabled,
    selectedNoteIds,
    onSelect,
    onUpdate,
    onClose,
}: Props) {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string>();
    const [shouldAutoCheck, setShouldAutoCheck] = useState<boolean>(false);
    const shouldAutoCheckRef = useRef<boolean>(false);
    shouldAutoCheckRef.current = shouldAutoCheck;
    const updateButtonActionRef = useRef<ButtonBaseActions>(null);

    const ankiQuerier = useCallback(
        (anki: Anki) => {
            const hasWordOrSentenceField = ankiSettings.sentenceField || ankiSettings.wordField;
            if (!searchTerm || !hasWordOrSentenceField) {
                return anki.findNotes('added:30');
            }

            const fields = [ankiSettings.wordField, ankiSettings.sentenceField].filter((f) => Boolean(f));
            return anki.findNotesWithFieldsContainingWord(searchTerm, fields);
        },
        [searchTerm, ankiSettings]
    );
    const { notes, error: ankiError, loading, search: searchAnki } = useSearchAnki({ anki, querier: ankiQuerier });

    const searchAnkiRef = useRef<typeof searchAnki>(searchAnki);
    useEffect(() => {
        if (open) {
            setSearchTerm('');
            setShouldAutoCheck(true);
            searchAnkiRef.current();
        }
    }, [open]);

    const onSelectRef = useRef<typeof onSelect>(onSelect);
    onSelectRef.current = onSelect;

    useEffect(() => {
        if (shouldAutoCheckRef.current && notes.length > 0) {
            onSelectRef.current([notes[0].noteId]);
            updateButtonActionRef.current?.focusVisible();
        } else {
            onSelectRef.current([]);
        }
    }, [notes]);

    const handleUpdateSelected = useCallback(async () => {
        if (selectedNoteIds.length === 0) return;
        try {
            await onUpdate([...selectedNoteIds]);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [selectedNoteIds, onUpdate]);

    const handleUpdateSingle = useCallback(
        async (noteId: number) => {
            try {
                await onUpdate([noteId]);
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            }
        },
        [onUpdate]
    );

    const handleToggleId = useCallback(
        (noteId: number) => {
            if (selectedNoteIds.includes(noteId)) {
                onSelect(selectedNoteIds.filter((n) => n !== noteId));
            } else {
                onSelect([...selectedNoteIds, noteId].sort());
                updateButtonActionRef.current?.focusVisible();
            }
        },
        [onSelect, selectedNoteIds]
    );

    const handleSearchKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter') {
                searchAnki();
            }
        },
        [searchAnki]
    );

    if (!open) return null;

    const effectiveError = error || ankiError;

    return (
        <Dialog open={open} maxWidth="sm" fullWidth onClose={onClose}>
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {t('cardSelectUi.title')}
                </Typography>
                <IconButton edge="end" disabled={disabled} onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Toolbar>

            <DialogContent>
                <Stack spacing={1}>
                    <TextField
                        size="small"
                        disabled={disabled || loading}
                        placeholder={t('ankiDialog.searchInAnki')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                        onKeyDown={handleSearchKeyDown}
                        slotProps={{
                            input: {
                                endAdornment: (
                                    <InputAdornment position="end" sx={{ mr: -1 }}>
                                        <IconButton loading={loading} onClick={searchAnki}>
                                            <SearchIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />
                    {effectiveError && <Alert severity="error">{effectiveError}</Alert>}
                    {notes.length === 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {t('cardSelectUi.noResults')}
                            </Typography>
                        </Box>
                    )}
                    {notes.length > 0 && (
                        <List dense sx={{ flex: 1, overflow: 'auto' }}>
                            {notes.map((note) => {
                                let preview = ankiSettings.sentenceField
                                    ? (note.fields[ankiSettings.sentenceField]?.value ?? '')
                                    : '';
                                if (!preview) {
                                    preview = ankiSettings.wordField
                                        ? (note.fields[ankiSettings.wordField]?.value ?? '')
                                        : '';
                                }
                                if (!preview) {
                                    preview = String(note.noteId);
                                }
                                preview = preview.replace(/<[^>]+>/g, '').slice(0, 80);
                                return (
                                    <ListItem
                                        key={note.noteId}
                                        sx={{ p: 0 }}
                                        secondaryAction={
                                            <IconButton
                                                edge="end"
                                                disabled={disabled || loading}
                                                onClick={() => handleUpdateSingle(note.noteId)}
                                            >
                                                <NoteAddIcon />
                                            </IconButton>
                                        }
                                    >
                                        <ListItemButton onClick={() => handleToggleId(note.noteId)}>
                                            <Checkbox
                                                edge="start"
                                                size="small"
                                                disabled={disabled || loading}
                                                checked={selectedNoteIds.includes(note.noteId)}
                                                tabIndex={-1}
                                                disableRipple
                                            />
                                            <Tooltip title={note.noteId}>
                                                <ListItemText
                                                    primary={preview}
                                                    slotProps={{
                                                        primary: { noWrap: true },
                                                        secondary: { noWrap: true },
                                                    }}
                                                />
                                            </Tooltip>
                                        </ListItemButton>
                                    </ListItem>
                                );
                            })}
                        </List>
                    )}
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button
                    action={updateButtonActionRef}
                    disabled={selectedNoteIds.length === 0 || disabled || loading}
                    onClick={handleUpdateSelected}
                >
                    {t('ankiDialog.updateSelectedCards', { count: selectedNoteIds.length })}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
