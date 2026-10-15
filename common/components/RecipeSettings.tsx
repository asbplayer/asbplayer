import {
    maximumRecipeNameLength,
    activeRecipe,
    deleteRecipe,
    effectiveSettings,
    moveRecipe,
    normalizeRecipe,
    recipeFromSettings,
    recipeImportUrl,
    recipeFromImportUrl,
    updateRecipeDraft,
    settingsWithRecipe,
} from '@project/common/settings';
import type { AsbplayerSettings, Recipe, RecipeSettings as Settings } from '@project/common/settings';
import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import {
    Alert,
    Box,
    Button,
    ButtonGroup,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    FormHelperText,
    Link,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';

import { PlayMode } from '@project/common';
import RecipeSelect from '@project/common/components/RecipeSelect';
import RecipeSummary from '@project/common/components/RecipeSummary';
import NoWrapButton from '@project/common/components/NoWrapButton';
import { playbackModeLabelLocKey } from '@project/common/playback/controllers/playback-mode-controller';

interface Props {
    settings: AsbplayerSettings;
    onSettingsChanged: (settings: Partial<AsbplayerSettings>) => void;
    children: (
        settings: AsbplayerSettings,
        onChange: (change: Partial<AsbplayerSettings>) => void,
        modes: React.ReactNode,
        readOnly: boolean
    ) => React.ReactNode;
}

const removeEntry = (settings: Settings, path: string[]): Settings => {
    const copy = structuredClone(settings);
    let parent: Record<string, unknown> = copy;
    for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
    delete parent[path.at(-1)!];
    return copy;
};

const validateImportedRecipe = (recipe: Recipe | undefined): Recipe | undefined => {
    if (recipe && DOMPurify.sanitize(recipe.name, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }) !== recipe.name) return;
    return recipe;
};

export default function RecipeSettings({ settings, onSettingsChanged, children }: Props) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<Recipe>();
    const [editingId, setEditingId] = useState<number | null>(null);
    // Import links open a preview; confirmation is the only action that saves settings.
    const parseRecipe = (text: string): Recipe | undefined => {
        try {
            return validateImportedRecipe(normalizeRecipe(JSON.parse(text)));
        } catch {
            return undefined;
        }
    };
    const [dialog, setDialog] = useState<'save' | 'import' | 'view'>();
    const [preview, setPreview] = useState<Recipe>();
    const [viewId, setViewId] = useState<number>();
    const [nameDirty, setNameDirty] = useState(false);
    const [paste, setPaste] = useState('');
    const [pasteError, setPasteError] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    useEffect(() => {
        const importFromUrl = () => {
            const url = new URL(window.location.href);
            const [section, query] = url.hash.split('?');
            const params = new URLSearchParams(query);
            if (!params.has('recipe')) return;
            const recipe = validateImportedRecipe(recipeFromImportUrl(url));
            setDialog('import');
            setPreview(recipe);
            setPaste('');
            setPasteError(!recipe);
            setConfirmDelete(false);
            params.delete('recipe');
            const remaining = params.toString();
            url.hash = remaining ? `${section}?${remaining}` : section;
            window.history.replaceState(window.history.state, '', url.toString());
        };
        importFromUrl();
        window.addEventListener('hashchange', importFromUrl);
        window.addEventListener('popstate', importFromUrl);
        return () => {
            window.removeEventListener('hashchange', importFromUrl);
            window.removeEventListener('popstate', importFromUrl);
        };
    }, []);
    const parseImport = (text: string) => {
        setPaste(text);
        const recipe = parseRecipe(text);
        setPreview(recipe);
        setPasteError(!!text && !recipe);
    };
    const selected = activeRecipe(settings);
    const readOnly = !!selected && !draft;
    const renderedSettings = draft ? settingsWithRecipe(settings, draft) : effectiveSettings(settings);
    const change = (update: Partial<AsbplayerSettings>) => {
        if (!draft) {
            if (!readOnly) onSettingsChanged(update);
            return;
        }
        setDraft(updateRecipeDraft(draft, renderedSettings, update));
    };
    const close = () => {
        setDialog(undefined);
        setPreview(undefined);
        setConfirmDelete(false);
    };
    const save = () => {
        const valid = normalizeRecipe(preview);
        if (!valid) return;
        const recipes = [...settings.recipes];
        let index = recipes.length;
        if (dialog === 'save' && editingId !== null && !nameDirty && recipes[editingId]) index = editingId;
        recipes[index] = valid;
        onSettingsChanged({ recipes, activeRecipeId: index });
        setDraft(undefined);
        close();
    };
    const matches = preview?.name.trim()
        ? settings.recipes
              .map((recipe, index) => ({
                  recipe,
                  index,
                  match: recipe.name.toLocaleLowerCase().indexOf(preview.name.trim().toLocaleLowerCase()),
              }))
              .filter(({ match }) => match >= 0)
              .sort((a, b) => a.match - b.match || a.recipe.name.length - b.recipe.name.length)
              .slice(0, 3)
        : [];
    const modeRecipe = draft ?? selected;
    const modes = modeRecipe && (
        <Stack direction="row" flexWrap="wrap">
            {Object.values(PlayMode)
                .filter((mode): mode is PlayMode => typeof mode === 'number')
                .map((mode) => (
                    <FormControlLabel
                        key={mode}
                        label={t(playbackModeLabelLocKey(mode))}
                        control={
                            <Checkbox
                                checked={modeRecipe.playbackModes.includes(mode)}
                                disabled={readOnly}
                                onChange={(event) => {
                                    if (!draft) return;
                                    let playbackModes =
                                        mode === PlayMode.normal
                                            ? [PlayMode.normal]
                                            : event.target.checked
                                              ? [...draft.playbackModes.filter((m) => m !== PlayMode.normal), mode]
                                              : draft.playbackModes.filter((m) => m !== mode);
                                    if (!playbackModes.length) playbackModes = [PlayMode.normal];
                                    setDraft({ ...draft, playbackModes });
                                }}
                            />
                        }
                    />
                ))}
        </Stack>
    );
    return (
        <Stack spacing={2} sx={{ pt: 1.5 }}>
            <Stack spacing={0.5}>
                <RecipeSelect
                    recipes={settings.recipes}
                    activeRecipeId={settings.activeRecipeId}
                    disabled={!!draft}
                    onSelect={(activeRecipeId) => onSettingsChanged({ activeRecipeId })}
                    onMove={(from, to) => onSettingsChanged(moveRecipe(settings, from, to))}
                    onView={(index) => {
                        setViewId(index);
                        setPreview(structuredClone(settings.recipes[index]));
                        setDialog('view');
                    }}
                />
                <FormHelperText sx={{ mx: 0 }}>
                    <Trans
                        i18nKey="recipes.introduction"
                        components={{
                            docs: (
                                <Link
                                    href="https://docs.asbplayer.dev/docs/guides/recipes"
                                    target="_blank"
                                    rel="noreferrer"
                                />
                            ),
                        }}
                    />
                    {readOnly && ` ${t('recipes.readOnly')}`}
                </FormHelperText>
            </Stack>
            <ButtonGroup fullWidth size="small" variant="contained">
                <NoWrapButton
                    fullWidth
                    startIcon={draft ? <SaveIcon /> : <EditIcon />}
                    onClick={() => {
                        if (draft) {
                            setPreview(structuredClone(draft));
                            setNameDirty(false);
                            setDialog('save');
                        } else {
                            setEditingId(settings.activeRecipeId);
                            setDraft(structuredClone(selected ?? recipeFromSettings(settings)));
                        }
                    }}
                >
                    {t(draft ? 'recipes.save' : 'recipes.edit')}
                </NoWrapButton>
                <NoWrapButton
                    fullWidth
                    startIcon={draft ? <CloseIcon /> : <UploadIcon />}
                    onClick={() => {
                        if (draft) {
                            setDraft(undefined);
                        } else {
                            setPaste('');
                            setPreview(undefined);
                            setPasteError(false);
                            setNameDirty(true);
                            setDialog('import');
                        }
                    }}
                >
                    {t(draft ? 'action.cancel' : 'recipes.import')}
                </NoWrapButton>
            </ButtonGroup>
            <Box
                sx={{
                    border: 0,
                    m: 0,
                    p: 0,
                    minWidth: 0,
                    ...(readOnly ? { borderLeft: 2, borderColor: 'primary.main', pl: 1 } : {}),
                }}
            >
                {children(renderedSettings, change, modes, readOnly)}
            </Box>
            <Dialog open={!!dialog} onClose={close} fullWidth maxWidth="sm">
                <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
                        {t(
                            dialog === 'save'
                                ? 'recipes.save'
                                : dialog === 'import'
                                  ? 'recipes.import'
                                  : 'recipes.recipe'
                        )}
                    </Typography>
                    {preview &&
                        (dialog === 'view' ? (
                            <Typography
                                variant="h6"
                                sx={{ maxWidth: '55%', overflowWrap: 'anywhere', textAlign: 'right' }}
                            >
                                {preview.name}
                            </Typography>
                        ) : (
                            <TextField
                                size="small"
                                sx={{ flex: 1, minWidth: 0, maxWidth: '55%' }}
                                autoFocus={dialog === 'save'}
                                label={t('about.depName')}
                                value={preview.name}
                                onFocus={(event) => event.target.select()}
                                slotProps={{ htmlInput: { maxLength: maximumRecipeNameLength } }}
                                onChange={(event) => {
                                    setNameDirty(true);
                                    setPreview({ ...preview, name: event.target.value });
                                }}
                                error={!preview.name.trim() || preview.name.trim().length > maximumRecipeNameLength}
                            />
                        ))}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        {dialog === 'import' && !preview && (
                            <TextField
                                multiline
                                minRows={3}
                                label={t('recipes.paste')}
                                value={paste}
                                onChange={(event) => parseImport(event.target.value)}
                                error={pasteError}
                                helperText={pasteError ? t('recipes.invalid') : undefined}
                            />
                        )}
                        {preview && (
                            <>
                                {dialog !== 'view' &&
                                    matches.map(({ recipe, index, match }) => (
                                        <Typography key={index} variant="body2">
                                            {index + 1}. {recipe.name.slice(0, match)}
                                            <strong>
                                                {recipe.name.slice(match, match + preview.name.trim().length)}
                                            </strong>
                                            {recipe.name.slice(match + preview.name.trim().length)}
                                        </Typography>
                                    ))}
                                <RecipeSummary
                                    recipe={preview}
                                    onRemove={
                                        dialog === 'view'
                                            ? undefined
                                            : (path) =>
                                                  setPreview({
                                                      ...preview,
                                                      settings: removeEntry(preview.settings, path),
                                                  })
                                    }
                                />
                                {dialog !== 'view' && preview.name.trim() && !normalizeRecipe(preview) && (
                                    <Alert severity="warning">{t('recipes.invalid')}</Alert>
                                )}
                            </>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ display: 'block', px: 3, pb: 2 }}>
                    <Stack spacing={2}>
                        {dialog === 'view' && preview && (
                            <>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ pt: 1 }}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label={t('recipes.importUrl')}
                                        value={recipeImportUrl(preview)}
                                        slotProps={{ htmlInput: { readOnly: true } }}
                                    />
                                    <IconButton
                                        aria-label={t('action.copy')}
                                        onClick={() => void navigator.clipboard.writeText(recipeImportUrl(preview))}
                                    >
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </Stack>
                                {confirmDelete && (
                                    <Alert severity="warning">
                                        {t('recipes.confirmDelete', { name: preview.name })}
                                    </Alert>
                                )}
                            </>
                        )}
                        <Stack direction="row" justifyContent="flex-end" spacing={1} useFlexGap flexWrap="wrap">
                            {dialog === 'view' && preview && (
                                <Button
                                    startIcon={<ContentCopyIcon />}
                                    sx={{ mr: 'auto' }}
                                    onClick={() => void navigator.clipboard.writeText(JSON.stringify(preview, null, 2))}
                                >
                                    {t('action.copy')}
                                </Button>
                            )}
                            {dialog === 'view' && (
                                <Button
                                    color="error"
                                    onClick={() => {
                                        if (!confirmDelete) {
                                            setConfirmDelete(true);
                                        } else if (viewId !== undefined) {
                                            onSettingsChanged(deleteRecipe(settings, viewId));
                                            close();
                                        }
                                    }}
                                >
                                    {t('action.delete')}
                                </Button>
                            )}
                            <Button onClick={close}>{t(dialog === 'view' ? 'action.close' : 'action.cancel')}</Button>
                            {dialog !== 'view' && (
                                <Button disabled={!normalizeRecipe(preview)} onClick={save}>
                                    {t(dialog === 'import' ? 'recipes.import' : 'action.save')}
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
