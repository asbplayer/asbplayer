import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { download, getCurrentTimeString } from '@project/common/util';
import { defaultSettings } from '@project/common/settings';
import { formatLogLine, formatRedactedLogText } from '@project/common/util/log-utils';
import type { LogLevel, LogLine } from '@project/common/util/log-utils';
import type { LogProvider } from '@project/common/util/log';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

interface Props {
    open: boolean;
    onClose: () => void;
    logProvider: LogProvider;
    streamingAppUrl: string;
}

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
    error: 'error.main',
    warning: 'warning.main',
    info: 'info.main',
    log: 'inherit',
    trace: 'grey.400',
};

const DEFAULT_LOG_LINE_COUNT = 100;

const LogViewerDialog: React.FC<Props> = ({ open, onClose, logProvider, streamingAppUrl }) => {
    const { t } = useTranslation();
    const [showTrace, setShowTrace] = useState(false);
    const [numberOfLines, setNumberOfLines] = useState(DEFAULT_LOG_LINE_COUNT);
    const [logLines, setLogLines] = useState<readonly LogLine[]>([]);
    const [loadError, setLoadError] = useState<string>();
    const numberOfLinesRef = useRef(DEFAULT_LOG_LINE_COUNT);
    const lastReloadedNumberOfLinesRef = useRef(DEFAULT_LOG_LINE_COUNT);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const scrollPositionRef = useRef<'top' | 'bottom' | number>('bottom');

    const scrollLogLines = useCallback(() => {
        const logContainer = logContainerRef.current;
        if (logContainer) {
            const position = scrollPositionRef.current;
            if (typeof position === 'number') {
                logContainer.scrollTop = position;
            } else {
                logContainer.scrollTo({
                    top: position === 'bottom' ? logContainer.scrollHeight : 0,
                    behavior: 'smooth',
                });
            }
        }
    }, []);

    const reloadLogLines = useCallback(
        async (scrollPosition?: 'bottom') => {
            const requestedNumberOfLines = numberOfLinesRef.current;
            const lineCountChanged = requestedNumberOfLines !== lastReloadedNumberOfLinesRef.current;
            try {
                const lines = await logProvider.getLogLines();
                scrollPositionRef.current =
                    scrollPosition ?? (lineCountChanged ? 'top' : (logContainerRef.current?.scrollTop ?? 0));
                lastReloadedNumberOfLinesRef.current = requestedNumberOfLines;
                setLogLines(lines);
                setLoadError(undefined);
            } catch (error) {
                setLoadError(error instanceof Error ? error.message : String(error));
            }
        },
        [logProvider]
    );

    useLayoutEffect(scrollLogLines, [logLines, scrollLogLines]);

    const handleExportLogs = useCallback(async () => {
        try {
            const lines = await logProvider.getLogLines();
            const logText = formatRedactedLogText(lines, streamingAppUrl, defaultSettings.streamingAppUrl);
            download(new Blob([logText], { type: 'text/plain' }), `asbplayer-logs-${getCurrentTimeString()}.txt`);
            setLoadError(undefined);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : String(error));
        }
    }, [logProvider, streamingAppUrl]);

    useEffect(() => {
        if (!open) return;
        void reloadLogLines('bottom');
    }, [open, reloadLogLines]);

    const displayedLogLines = logLines
        .filter((logLine) => showTrace || logLine.level !== 'trace')
        .slice(-numberOfLines);

    const handleCopyLogs = async () => {
        try {
            const logText = formatRedactedLogText(displayedLogLines, streamingAppUrl, defaultSettings.streamingAppUrl);
            await navigator.clipboard.writeText(logText);
            setLoadError(undefined);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : String(error));
        }
    };

    return (
        <Dialog
            fullWidth
            maxWidth="md"
            open={open}
            onClose={onClose}
            aria-label={t('settings.logs')}
            slotProps={{ transition: { onEntered: scrollLogLines } }}
        >
            <Toolbar sx={{ gap: 1 }}>
                <Typography
                    variant="h6"
                    noWrap
                    sx={{ minWidth: 0, flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                    {t('settings.logs')}
                </Typography>
                <FormControlLabel
                    sx={{ mx: 0, minWidth: 0 }}
                    slotProps={{
                        typography: {
                            noWrap: true,
                            component: 'span',
                            sx: {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                minWidth: 0,
                            },
                        },
                    }}
                    control={<Switch checked={showTrace} onChange={(event) => setShowTrace(event.target.checked)} />}
                    label={t('settings.traceLogging')}
                />
                <IconButton aria-label={t('action.close')} onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Toolbar>
            <DialogContent dividers>
                {loadError && <Alert severity="error">{loadError}</Alert>}
                <Box
                    ref={logContainerRef}
                    component="div"
                    role="log"
                    sx={{
                        minHeight: '20rem',
                        maxHeight: '60vh',
                        overflow: 'auto',
                        m: 0,
                        fontFamily: 'monospace',
                    }}
                >
                    {displayedLogLines.map((logLine, index) => (
                        <Box
                            component="div"
                            key={`${logLine.timestamp}-${index}`}
                            sx={{
                                px: 1,
                                py: 0.5,
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                                color: LOG_LEVEL_COLORS[logLine.level],
                                backgroundColor: index % 2 === 0 ? 'background.default' : 'action.hover',
                            }}
                        >
                            {formatLogLine(logLine)}
                        </Box>
                    ))}
                </Box>
            </DialogContent>
            <DialogActions>
                <TextField
                    size="small"
                    type="number"
                    label={t('settings.lines')}
                    value={numberOfLines}
                    onChange={(event) => {
                        const value = Math.max(1, Math.floor(Number(event.target.value)));
                        if (Number.isFinite(value)) {
                            numberOfLinesRef.current = value;
                            setNumberOfLines(value);
                        }
                    }}
                    slotProps={{
                        htmlInput: {
                            min: 1,
                            step: 1,
                        },
                    }}
                    sx={{ width: 100 }}
                />
                <div style={{ display: 'flex', flexGrow: 1 }} />
                <Button startIcon={<DownloadIcon />} onClick={() => void handleExportLogs()}>
                    {t('ankiDialog.export')}
                </Button>
                <Button startIcon={<ContentCopyIcon />} onClick={() => void handleCopyLogs()}>
                    {t('action.copy')}
                </Button>
                <Button startIcon={<RefreshIcon />} onClick={() => void reloadLogLines()}>
                    {t('action.reload')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default LogViewerDialog;
