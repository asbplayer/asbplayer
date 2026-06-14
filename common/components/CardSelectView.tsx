import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import { Anki, NoteInfo } from '@project/common/anki';

const MULTI_SELECT_KEY = 'cardSelectMultiSelect';

interface Props {
    open: boolean;
    anki: Anki;
    sentenceField?: string;
    disabled?: boolean;
    onSelect: (noteIds: number[]) => Promise<void> | void;
    onCancel: () => void;
}

export default function CardSelectView({ open, anki, sentenceField, disabled, onSelect, onCancel }: Props) {
    const { t } = useTranslation();
    const [notes, setNotes] = useState<NoteInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();
    const [search, setSearch] = useState('');
    const [multiSelect, setMultiSelect] = useState(() => localStorage.getItem(MULTI_SELECT_KEY) === 'true');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (!open) {
            setSearch('');
            setError(undefined);
            setNotes([]);
            setSelectedIds(new Set());
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(undefined);

        anki.findNotes('added:30')
            .then((noteIds) => {
                if (cancelled) return;
                const sorted = [...noteIds].sort((a, b) => b - a).slice(0, 50);
                return anki.notesInfo(sorted);
            })
            .then((infos) => {
                if (cancelled || !infos) return;
                setNotes(infos);
            })
            .catch((e) => {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : String(e));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, anki]);

    const handleSelectSingle = useCallback(
        async (noteId: number) => {
            try {
                await onSelect([noteId]);
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            }
        },
        [onSelect]
    );

    const handleApply = useCallback(async () => {
        if (selectedIds.size === 0) return;
        try {
            await onSelect([...selectedIds]);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, [selectedIds, onSelect]);

    const handleMultiSelectChange = useCallback((checked: boolean) => {
        setMultiSelect(checked);
        localStorage.setItem(MULTI_SELECT_KEY, String(checked));
        setSelectedIds(new Set());
    }, []);

    const handleToggleId = useCallback((noteId: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(noteId)) next.delete(noteId);
            else next.add(noteId);
            return next;
        });
    }, []);

    const filteredNotes = useMemo(() => {
        if (!search.trim()) return notes;
        const lower = search.toLowerCase();
        return notes.filter((note) => {
            const keyValue = Object.values(note.fields).find((f) => f.order === 0)?.value ?? '';
            const sentence = sentenceField ? (note.fields[sentenceField]?.value ?? '') : '';
            const combined = (keyValue + ' ' + sentence).toLowerCase();
            return combined.includes(lower);
        });
    }, [notes, search, sentenceField]);

    if (!open) return null;

    return (
        <Box
            sx={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.6)',
                zIndex: (theme) => theme.zIndex.modal + 1,
            }}
            onClick={onCancel}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: 420,
                    maxWidth: '90vw',
                    maxHeight: '70vh',
                    p: 2,
                    gap: 1,
                    bgcolor: 'rgba(18,18,18,0.97)',
                    color: 'text.primary',
                    borderRadius: 2,
                    boxShadow: 8,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h6">{t('cardSelectUi.title')}</Typography>
                    <Typography variant="body2" sx={{ cursor: 'pointer', color: 'text.secondary' }} onClick={onCancel}>
                        {t('action.cancel')}
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <TextField
                        size="small"
                        placeholder={t('cardSelectUi.searchPlaceholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                        sx={{ flex: 1, mr: 1 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                size="small"
                                checked={multiSelect}
                                onChange={(e) => handleMultiSelectChange(e.target.checked)}
                            />
                        }
                        label={
                            <Typography variant="caption" noWrap>
                                {t('cardSelectUi.multiSelect')}
                            </Typography>
                        }
                        sx={{ m: 0, flexShrink: 0 }}
                    />
                </Box>

                {error && <Alert severity="error">{error}</Alert>}

                {loading || disabled ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
                        <CircularProgress size={32} />
                    </Box>
                ) : (
                    <List dense sx={{ flex: 1, overflow: 'auto' }}>
                        {filteredNotes.length === 0 && !loading && (
                            <Typography variant="body2" sx={{ color: 'text.secondary', p: 1 }}>
                                {t('cardSelectUi.noResults')}
                            </Typography>
                        )}
                        {filteredNotes.map((note) => {
                            const keyValue =
                                Object.values(note.fields).find((f) => f.order === 0)?.value ?? `Note ${note.noteId}`;
                            const rawSentence = sentenceField ? (note.fields[sentenceField]?.value ?? '') : '';
                            const sentence = rawSentence.replace(/<[^>]+>/g, '').slice(0, 80);
                            if (multiSelect) {
                                return (
                                    <ListItemButton
                                        key={note.noteId}
                                        onClick={() => handleToggleId(note.noteId)}
                                        disabled={disabled}
                                        dense
                                    >
                                        <Checkbox
                                            edge="start"
                                            size="small"
                                            checked={selectedIds.has(note.noteId)}
                                            tabIndex={-1}
                                            disableRipple
                                        />
                                        <ListItemText
                                            primary={keyValue}
                                            secondary={sentence || note.modelName}
                                            primaryTypographyProps={{ noWrap: true }}
                                            secondaryTypographyProps={{ noWrap: true }}
                                        />
                                    </ListItemButton>
                                );
                            }
                            return (
                                <ListItemButton
                                    key={note.noteId}
                                    onClick={() => handleSelectSingle(note.noteId)}
                                    disabled={disabled}
                                >
                                    <ListItemText
                                        primary={keyValue}
                                        secondary={sentence || note.modelName}
                                        primaryTypographyProps={{ noWrap: true }}
                                        secondaryTypographyProps={{ noWrap: true }}
                                    />
                                </ListItemButton>
                            );
                        })}
                    </List>
                )}

                {multiSelect && (
                    <Button
                        variant="contained"
                        disabled={selectedIds.size === 0 || disabled}
                        onClick={handleApply}
                        fullWidth
                        size="small"
                    >
                        {t('action.apply')} {selectedIds.size > 0 && `(${selectedIds.size})`}
                    </Button>
                )}
            </Box>
        </Box>
    );
}
