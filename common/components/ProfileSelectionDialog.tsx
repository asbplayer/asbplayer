import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
    open: boolean;
    title: string;
    confirmLabel: string;
    // Undefined targets the default profile
    profiles: (string | undefined)[];
    onConfirm: (selected: (string | undefined)[]) => void;
    onClose: () => void;
}

const ProfileSelectionDialog = ({ open, title, confirmLabel, profiles, onConfirm, onClose }: Props) => {
    const { t } = useTranslation();
    const [selected, setSelected] = useState<Set<string | undefined>>(new Set());

    useEffect(() => {
        if (open) {
            setSelected(new Set(profiles));
        }
    }, [open, profiles]);

    const toggle = (name: string | undefined) => {
        setSelected((current) => {
            const next = new Set(current);

            if (next.has(name)) {
                next.delete(name);
            } else {
                next.add(name);
            }

            return next;
        });
    };

    const checkAll = () => {
        setSelected(new Set(profiles));
    };

    const checkNone = () => {
        setSelected(new Set());
    };

    const confirm = () => {
        onConfirm(profiles.filter((name) => selected.has(name)));
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {title}
                </Typography>
                <IconButton edge="end" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Toolbar>
            <DialogContent>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Button size="small" onClick={checkAll}>
                        {t('action.checkAll')}
                    </Button>
                    <Button size="small" onClick={checkNone}>
                        {t('action.checkNone')}
                    </Button>
                </Stack>
                <FormGroup>
                    {profiles.map((name) => (
                        <FormControlLabel
                            key={name ?? ''}
                            control={<Checkbox checked={selected.has(name)} onChange={() => toggle(name)} />}
                            label={name ?? t('settings.defaultProfile')}
                        />
                    ))}
                </FormGroup>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('action.cancel')}</Button>
                <Button onClick={confirm} disabled={selected.size === 0}>
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ProfileSelectionDialog;
