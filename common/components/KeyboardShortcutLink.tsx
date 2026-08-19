import KeyboardIcon from '@mui/icons-material/Keyboard';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';

interface Props {
    onClick: () => void;
    sectionTitle: string;
}

export default function KeyboardShortcutLink({ onClick, sectionTitle }: Props) {
    return (
        <Tooltip title={sectionTitle}>
            <IconButton
                type="button"
                size="small"
                color="inherit"
                aria-label={sectionTitle}
                onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onClick();
                }}
                sx={{ ml: 0.5, p: 0.25, verticalAlign: 'middle' }}
            >
                <KeyboardIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    );
}
