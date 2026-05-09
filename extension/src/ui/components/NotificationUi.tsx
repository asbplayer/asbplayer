import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Bridge from '../bridge';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import { PaletteMode } from '@mui/material/styles';
import { Message, UpdateStateMessage } from '@project/common';
import { createTheme } from '@project/common/theme';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import LogoIcon from '@project/common/components/LogoIcon';
import Link from '@mui/material/Link';

interface Props {
    bridge: Bridge;
}

const NotificationUi = ({ bridge }: Props) => {
    const { t } = useTranslation();
    const handleClose = useCallback(() => {
        setShowAlert(false);
        setNewVersion(undefined);
        bridge.sendMessageFromServer({
            command: 'close',
        });
    }, [bridge]);
    const [title, setTitle] = useState<string>();
    const [message, setMessage] = useState<string>();
    const [newVersion, setNewVersion] = useState<string>();
    const [showAlert, setShowAlert] = useState<boolean>(false);

    useEffect(() => {
        bridge.addClientMessageListener((message: Message) => {
            if (message.command !== 'updateState') {
                return;
            }

            const state = (message as UpdateStateMessage).state;

            if (state.themeType !== undefined) {
                setThemeType(state.themeType);
            }

            if (state.titleLocKey !== undefined) {
                setTitle(state.titleLocKey === '' ? '' : (t(state.titleLocKey) ?? ''));
            }

            if (state.messageLocKey !== undefined) {
                setMessage(state.messageLocKey === '' ? '' : (t(state.messageLocKey) ?? ''));
            }

            if (state.newVersion !== undefined) {
                setNewVersion(state.newVersion);
                setShowAlert(true);
            }
        });
    }, [bridge, t]);

    useEffect(() => bridge.serverIsReady(), [bridge]);

    const [themeType, setThemeType] = useState<PaletteMode>('dark');
    const theme = useMemo(() => createTheme(themeType), [themeType]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {message && title && (
                <Dialog open={true} disableEnforceFocus fullWidth maxWidth="sm" onClose={handleClose}>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogContent>{message}</DialogContent>
                    <DialogActions>
                        <Button onClick={handleClose}>{t('action.ok')}</Button>
                    </DialogActions>
                </Dialog>
            )}
            {newVersion && (
                <Snackbar
                    open={showAlert}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    onClose={handleClose}
                >
                    <Alert icon={<LogoIcon />} severity="info" onClose={handleClose}>
                        <Trans
                            i18nKey="update.alert"
                            values={{ version: newVersion }}
                            components={[
                                <Link
                                    key={0}
                                    color="primary"
                                    target="_blank"
                                    rel="noreferrer"
                                    href={`https://github.com/asbplayer/asbplayer/releases/tag/v${newVersion}`}
                                >
                                    release notes
                                </Link>,
                            ]}
                        />
                    </Alert>
                </Snackbar>
            )}
        </ThemeProvider>
    );
};

export default NotificationUi;
