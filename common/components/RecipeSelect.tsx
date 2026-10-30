import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FormControl, InputLabel, Select, MenuItem, Stack, IconButton, Tooltip } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { Recipe } from '@project/common/settings';

interface Props {
    recipes: readonly Recipe[];
    activeRecipeId: number | null;
    onSelect: (index: number | null) => void;
    onView?: (index: number) => void;
    onMove?: (from: number, to: number) => void;
    disabled?: boolean;
    native?: boolean;
}

export default function RecipeSelect({ recipes, activeRecipeId, onSelect, onView, onMove, disabled, native }: Props) {
    const { t } = useTranslation();
    const labelId = useId();
    const label = (index: number) => `${index + 1}. ${recipes[index]?.name ?? ''}`;
    return (
        <FormControl
            size="small"
            sx={{ minWidth: 120, maxWidth: '100%', color: activeRecipeId !== null ? 'primary.main' : undefined }}
            disabled={disabled}
        >
            <InputLabel id={labelId} htmlFor={`${labelId}-select`}>
                {t('recipes.recipe')}
            </InputLabel>
            <Select
                id={`${labelId}-select`}
                labelId={labelId}
                label={t('recipes.recipe')}
                value={activeRecipeId ?? -1}
                native={native}
                onChange={(event) => onSelect(Number(event.target.value) === -1 ? null : Number(event.target.value))}
                renderValue={(index) => (index === -1 ? t('pauseOnHoverMode.disabled') : label(index))}
                sx={{ color: activeRecipeId !== null ? 'primary.main' : undefined }}
            >
                {native ? (
                    <>
                        <option value={-1}>{t('pauseOnHoverMode.disabled')}</option>
                        {recipes.map((recipe, index) => (
                            <option key={index} value={index}>
                                {label(index)}
                            </option>
                        ))}
                    </>
                ) : (
                    <MenuItem value={-1}>{t('pauseOnHoverMode.disabled')}</MenuItem>
                )}
                {!native &&
                    recipes.map((recipe, index) => (
                        <MenuItem
                            key={index}
                            value={index}
                            draggable={!!onMove}
                            onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))}
                            onDragOver={(event) => onMove && event.preventDefault()}
                            onDrop={(event) => {
                                event.preventDefault();
                                const from = Number(event.dataTransfer.getData('text/plain'));
                                if (Number.isInteger(from)) onMove?.(from, index);
                            }}
                        >
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
                                <span style={{ flex: 1 }}>{label(index)}</span>
                                {onView && (
                                    <Tooltip title={t('action.preview')}>
                                        <IconButton
                                            size="small"
                                            aria-label={t('action.preview')}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onView(index);
                                            }}
                                        >
                                            <VisibilityIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {onMove && (
                                    <>
                                        <IconButton
                                            size="small"
                                            disabled={index === 0}
                                            aria-label={t('settings.moveUpInCardCreator')}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onMove(index, index - 1);
                                            }}
                                        >
                                            <ArrowUpwardIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            disabled={index === recipes.length - 1}
                                            aria-label={t('settings.moveDownInCardCreator')}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onMove(index, index + 1);
                                            }}
                                        >
                                            <ArrowDownwardIcon fontSize="small" />
                                        </IconButton>
                                    </>
                                )}
                            </Stack>
                        </MenuItem>
                    ))}
            </Select>
        </FormControl>
    );
}
