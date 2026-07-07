import Dialog from '@mui/material/Dialog';
import Toolbar from '@mui/material/Toolbar';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';

interface Props {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const ConfirmDisableCspDialog = ({ open, onClose, onConfirm }: Props) => {
    const { t } = useTranslation();
    return (
        <Dialog open={open} onClose={onClose}>
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {t('extension.settings.pages.disableCspConfirmation.title')}
                </Typography>
                <IconButton edge="end" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Toolbar>
            <DialogContent>{t('extension.settings.pages.disableCspConfirmation.body')}</DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('action.cancel')}</Button>
                <Button onClick={onConfirm} color="error">
                    {t('action.confirmUnderstanding')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDisableCspDialog;
