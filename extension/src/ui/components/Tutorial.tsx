import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import React, { useState, useEffect, useRef } from 'react';
import Fade from '@mui/material/Fade';
import Button from '@mui/material/Button';
import TabRegistry from '@/services/tab-registry';
import { SettingsProvider } from '@project/common/settings';
import { ExtensionSettingsStorage } from '@/services/extension-settings-storage';
import Dialog from '@mui/material/Dialog';
import { isMobile } from 'react-device-detect';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import useMediaQuery from '@mui/material/useMediaQuery';
import IconButton from '@mui/material/IconButton';
import { Trans } from 'react-i18next';
import Link from '@mui/material/Link';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { AsbPlayerToVideoCommandV2, RequestSubtitlesMessage, RequestSubtitlesResponse } from '@project/common';
import TutorialBubble from '@project/common/components/TutorialBubble';
import { isFirefox } from '@project/common/browser-detection';

const settingsProvider = new SettingsProvider(new ExtensionSettingsStorage());
const tabRegistry = new TabRegistry(settingsProvider);
const zIndexTop = 2147483648;

const useExtensionState = () => {
    const [sidePanelOpen, setSidePanelOpen] = useState<boolean>();
    const [loadedSubtitlesCount, setLoadedSubtitlesCount] = useState<number>();
    const [currentTabId, setCurrentTabId] = useState<number>();
    useEffect(() => {
        browser.tabs.getCurrent().then((t) => setCurrentTabId(t?.id));
    }, []);
    useEffect(() => {
        const interval = setInterval(() => {
            tabRegistry
                .findAsbplayer({
                    filter: (asbplayer) => asbplayer.sidePanel ?? false,
                    allowTabCreation: false,
                })
                .then((asbplayer) => setSidePanelOpen(asbplayer !== undefined));

            tabRegistry.activeVideoElements().then(async (elems) => {
                const currentElem = elems.find((elem) => elem.id === currentTabId && elem.synced);

                if (currentElem !== undefined) {
                    const message: AsbPlayerToVideoCommandV2<RequestSubtitlesMessage> = {
                        sender: 'asbplayerv2',
                        message: {
                            command: 'request-subtitles',
                        },
                        tabId: currentElem.id,
                        src: currentElem.src,
                    };
                    const response = (await browser.runtime.sendMessage(message)) as
                        | RequestSubtitlesResponse
                        | undefined;

                    setLoadedSubtitlesCount(response?.subtitles?.length);
                }
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [currentTabId]);
    return { sidePanelOpen, loadedSubtitlesCount };
};

enum Step {
    toolbar = 1,
    loadSubtitles = 2,
    sidePanel = 3,
    overlay = 4,
    overlayScrollControl = 5,
    almostDone = 6,
    done = 7,
}

const ToolbarBubble: React.FC<{ show: boolean; onConfirm: () => void }> = ({ show, onConfirm }) => {
    return (
        <TutorialBubble
            show={show}
            placement="bottom"
            text={
                <Trans
                    i18nKey="ftue.toolbar"
                    components={[<b key={0}>asbplayer</b>, <b key={1}>Popup</b>, <p key={2} />]}
                    values={{ pin: isFirefox ? '⚙' : '📌' }}
                />
            }
            onConfirm={onConfirm}
        >
            <div style={{ position: 'fixed', right: isFirefox ? 60 : 185, top: 5 }} />
        </TutorialBubble>
    );
};

const LoadSubtitlesDialog: React.FC<{ open: boolean; count?: number; onClose: () => void }> = ({
    open,
    count,
    onClose,
}) => {
    return (
        <Dialog style={{ zIndex: zIndexTop }} open={open}>
            <DialogContent>
                {count === undefined && !isMobile && (
                    <Trans
                        i18nKey="ftue.loadSubtitles"
                        components={[
                            <b key={0}>Side Panel</b>,
                            <p key={1} />,
                            <b key={2}>Side Panel</b>,
                            <b key={3}>Popup</b>,
                        ]}
                    />
                )}
                {count === undefined && isMobile && (
                    <Trans
                        i18nKey="ftue.loadSubtitlesMobile"
                        components={[<b key={0}>asbplayer</b>, <b key={1}>extensions</b>]}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
};

const SidePanelBubble: React.FC<{ show: boolean; onConfirm: () => void }> = ({ show, onConfirm }) => {
    return (
        <TutorialBubble
            show={show}
            placement="left"
            text={
                <Trans
                    i18nKey="ftue.sidePanel"
                    components={[<b key={0}>Side Panel</b>, <b key={1}>navigate</b>, <b key={2}>mine</b>]}
                />
            }
            onConfirm={onConfirm}
        >
            <div style={{ position: 'absolute', right: 0, top: '10%' }} />
        </TutorialBubble>
    );
};

const OverlayBubble: React.FC<{ show: boolean; onConfirm: () => void }> = ({ show, onConfirm }) => {
    return (
        <TutorialBubble
            show={show}
            placement="bottom"
            text={
                <Trans
                    i18nKey="ftue.overlay"
                    components={[
                        <b key={0}>Video Overlay</b>,
                        <b key={1}>toggle</b>,
                        <b key={2}>mine</b>,
                        <b key={3}>switch playback modes</b>,
                    ]}
                />
            }
            onConfirm={onConfirm}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 55,
                    left: '50%',
                    transform: 'translateX(calc(-50% - 85px))',
                }}
            />
        </TutorialBubble>
    );
};

const OverlayScrollBubble: React.FC<{ show: boolean; onConfirm: () => void }> = ({ show, onConfirm }) => {
    return (
        <TutorialBubble
            show={show}
            placement="bottom"
            text={
                <Trans
                    i18nKey={'ftue.overlayScroll'}
                    components={[
                        <b key={0}>Scroll</b>,
                        <b key={1}>subtitle navigation</b>,
                        <b key={2}>subtitle offset</b>,
                        <b key={3}>playback rate</b>,
                    ]}
                />
            }
            onConfirm={onConfirm}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 55,
                    left: '50%',
                    transform: 'translateX(calc(-50% + 80px))',
                }}
            />
        </TutorialBubble>
    );
};

const FinishedDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    return (
        <Dialog open={open} style={{ zIndex: zIndexTop }}>
            <DialogContent>
                <Trans
                    i18nKey={'ftue.congrats'}
                    components={[
                        <Link href="/options.html#about" target="_blank" rel="noreferrer" key={0}>
                            Settings
                        </Link>,
                        <p key={1} />,
                        <Link href="https://docs.asbplayer.dev/docs/intro/" target="_blank" rel="noreferrer" key={2}>
                            user guide
                        </Link>,
                    ]}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>OK</Button>
            </DialogActions>
        </Dialog>
    );
};

const Tutorial: React.FC<{ className: string; show: boolean }> = ({ className, show }) => {
    const { sidePanelOpen, loadedSubtitlesCount } = useExtensionState();
    const [step, setStep] = useState<Step>(Step.toolbar);

    useEffect(() => {
        if (step === Step.toolbar && isMobile) {
            setStep(Step.loadSubtitles);
        }
    }, [step]);

    useEffect(() => {
        if (step === Step.loadSubtitles && loadedSubtitlesCount !== undefined) {
            setStep(sidePanelOpen ? Step.sidePanel : Step.overlay);
        }
    }, [step, sidePanelOpen, loadedSubtitlesCount]);

    useEffect(() => {
        if (step == Step.overlay) {
            settingsProvider.getSingle('streamingEnableOverlay').then((overlayEnabled) => {
                if (overlayEnabled) {
                    videoRef.current?.pause();
                } else {
                    setStep(Step.almostDone);
                }
            });
        }
    }, [step]);

    const [playing, setPlaying] = useState<boolean>(false);
    const videoRef = useRef<HTMLVideoElement | null>(undefined);

    const handleVideoClick = () => {
        if (playing) {
            videoRef.current?.pause();
        } else {
            videoRef.current?.play();
        }
    };

    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [showLoadSubtitles, setShowLoadSubtitles] = useState<boolean>(true);

    return (
        <Paper square sx={{ position: 'relative' }} className={className}>
            {show && (
                <Fade in={true}>
                    <Box
                        sx={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <div style={{ width: isSmallScreen ? '100%' : '80%', maxHeight: '100dvh' }}>
                            <div style={{ position: 'relative', width: '100%', height: '100%', maxHeight: '100dvh' }}>
                                <video
                                    ref={(elm) => {
                                        videoRef.current = elm;

                                        if (elm) {
                                            elm.volume = Math.min(elm.volume, 0.5);
                                        }
                                    }}
                                    onPlay={() => setPlaying(true)}
                                    onPause={() => setPlaying(false)}
                                    style={{ width: '100%', maxHeight: '100dvh' }}
                                    src={browser.runtime.getURL('/assets/tutorial.mp4')}
                                    onClick={handleVideoClick}
                                />
                                <div
                                    style={{
                                        position: 'absolute',
                                        transform: 'translateY(-50%) translateX(-50%) scale(400%)',
                                        top: '50%',
                                        left: '50%',
                                    }}
                                >
                                    {!playing && (
                                        <IconButton onClick={() => videoRef.current?.play()}>
                                            <PlayArrowIcon />
                                        </IconButton>
                                    )}
                                </div>
                                <OverlayBubble
                                    show={show && step === Step.overlay}
                                    onConfirm={() => setStep(Step.overlayScrollControl)}
                                />
                                <OverlayScrollBubble
                                    show={show && step === Step.overlayScrollControl}
                                    onConfirm={() => setStep(Step.almostDone)}
                                />
                            </div>
                        </div>
                    </Box>
                </Fade>
            )}
            <ToolbarBubble show={show && step === Step.toolbar} onConfirm={() => setStep(Step.loadSubtitles)} />
            <SidePanelBubble show={show && step === Step.sidePanel} onConfirm={() => setStep(Step.overlay)} />
            <LoadSubtitlesDialog
                open={show && step === Step.loadSubtitles && showLoadSubtitles}
                count={loadedSubtitlesCount}
                onClose={() => setShowLoadSubtitles(false)}
            />
            <FinishedDialog open={show && step === Step.almostDone} onClose={() => setStep(Step.done)} />
        </Paper>
    );
};

export default Tutorial;
