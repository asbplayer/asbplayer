import React from 'react';
import { useTranslation } from 'react-i18next';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import type { IconButtonProps } from '@mui/material/IconButton';
import TuneIcon from '@mui/icons-material/Tune';
import Tooltip from '@project/common/components/Tooltip';
import type { Recipe } from '@project/common/settings';

interface Props extends IconButtonProps {
    recipes?: readonly Recipe[];
    activeRecipeId?: number | null;
    tooltipProps?: Omit<React.ComponentProps<typeof Tooltip>, 'title' | 'children'>;
}

const PlaybackModeButton = React.forwardRef<HTMLButtonElement, Props>(function PlaybackModeButton(
    { recipes, activeRecipeId, tooltipProps, ...buttonProps },
    ref
) {
    const { t } = useTranslation();
    const recipe = activeRecipeId == null ? undefined : recipes?.[activeRecipeId];
    const title = recipe
        ? `${t('controls.playbackMode')} · ${t('recipes.notification', { name: recipe.name })}`
        : t('controls.playbackMode');
    const icon = <TuneIcon color={recipe && !buttonProps.disabled ? 'primary' : 'inherit'} />;

    return (
        <Tooltip {...tooltipProps} title={title}>
            <span>
                <IconButton ref={ref} aria-label={title} aria-haspopup="dialog" {...buttonProps}>
                    {recipe && activeRecipeId != null ? (
                        <Badge
                            color="primary"
                            badgeContent={activeRecipeId + 1}
                            sx={{
                                '& .MuiBadge-badge': { pointerEvents: 'none', fontSize: 10, minWidth: 16, height: 16 },
                            }}
                        >
                            {icon}
                        </Badge>
                    ) : (
                        icon
                    )}
                </IconButton>
            </span>
        </Tooltip>
    );
});

export default PlaybackModeButton;
