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
import useSnackbar from '@project/common/hooks/use-snackbar';
import { createTheme } from '@project/common/theme';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import LogoIcon from '@project/common/components/LogoIcon';
import Link from '@mui/material/Link';

interface Props {
    bridge: Bridge;
}

interface SnackbarState {
    readonly messageLocKey: string;
    readonly actionLocKey?: string;
    readonly replacements?: Record<string, string>;
}

interface NotificationState {
    readonly themeType?: PaletteMode;
    readonly titleLocKey?: string;
    readonly messageLocKey?: string;
    readonly snackbar?: SnackbarState;
    readonly newVersion?: string;
}

const NotificationUi = ({ bridge }: Props) => {
    const { t } = useTranslation();
    const handleClose = useCallback(() => {
        setShowAlert(false);
        setNewVersion(undefined);
        setSnackbar(undefined);
        bridge.sendMessageFromServer({
            command: 'close',
        });
    }, [bridge]);
    const [title, setTitle] = useState<string>();
    const [message, setMessage] = useState<string>();
    const [snackbar, setSnackbar] = useState<SnackbarState>();
    const [newVersion, setNewVersion] = useState<string>();
    const [showAlert, setShowAlert] = useState<boolean>(false);
    const resumeSnackbar = useSnackbar({
        open: snackbar !== undefined,
        onClose: handleClose,
    });

    useEffect(() => {
        bridge.addClientMessageListener((message: Message) => {
            if (message.command !== 'updateState') {
                return;
            }

            const state = (message as UpdateStateMessage).state as NotificationState;

            if (state.themeType !== undefined) {
                setThemeType(state.themeType);
            }

            if (state.titleLocKey !== undefined) {
                setSnackbar(undefined);
                setTitle(state.titleLocKey === '' ? '' : (t(state.titleLocKey) ?? ''));
            }

            if (state.messageLocKey !== undefined) {
                setMessage(state.messageLocKey === '' ? '' : (t(state.messageLocKey) ?? ''));
            }

            if (state.snackbar !== undefined) {
                setSnackbar(state.snackbar);
            }

            if (state.newVersion !== undefined) {
                setNewVersion(state.newVersion);
                setShowAlert(true);
            }
        });
    }, [bridge, t]);

    const handleSnackbarAction = useCallback(() => {
        setSnackbar(undefined);
        bridge.sendMessageFromServer({ command: 'action' });
    }, [bridge]);

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
            {snackbar && (
                <Snackbar
                    open={resumeSnackbar.open}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    onClose={resumeSnackbar.close}
                    onMouseEnter={resumeSnackbar.onMouseEnter}
                    onMouseLeave={resumeSnackbar.onMouseLeave}
                >
                    <Alert
                        severity="info"
                        onClose={resumeSnackbar.close}
                        icon={<LogoIcon fontSize="small" />}
                        action={
                            snackbar.actionLocKey && (
                                <Button color="inherit" size="small" onClick={handleSnackbarAction}>
                                    {t(snackbar.actionLocKey)}
                                </Button>
                            )
                        }
                    >
                        {t(snackbar.messageLocKey, snackbar.replacements ?? {})}
                    </Alert>
                </Snackbar>
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
