import TutorialBubble from '@project/common/components/TutorialBubble';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import { useState } from 'react';
import { Trans } from 'react-i18next';

const AnkiDialogTutorialBubble: React.FC<{
    disabled: boolean;
    show: boolean;
    children: React.ReactElement;
    onConfirm: () => void;
}> = ({ disabled, show, children, onConfirm }) => {
    const [showAnkiExplanation, setShowAnkiExplanation] = useState<boolean>();
    return (
        <TutorialBubble
            placement="bottom"
            disabled={disabled}
            disableArrow
            text={
                showAnkiExplanation ? (
                    <Trans
                        i18nKey="ftue.anki"
                        components={[
                            <Link key={0} href="https://apps.ankiweb.net/" target="_blank">
                                Anki
                            </Link>,
                            <b key={1}>SRS</b>,
                        ]}
                    />
                ) : (
                    <>
                        <Trans
                            i18nKey="ftue.ankiDialog"
                            components={[
                                <b key={0}>Anki Export Dialog</b>,
                                <b key={1}>sentence</b>,
                                <b key={2}>image</b>,
                                <b key={3}>audio</b>,
                            ]}
                        />
                        <p />
                        <Button onClick={() => setShowAnkiExplanation(true)} variant="contained" fullWidth>
                            <Trans i18nKey="ftue.whatsAnki" />
                        </Button>
                    </>
                )
            }
            onConfirm={onConfirm}
            show={show}
        >
            {children}
        </TutorialBubble>
    );
};

export default AnkiDialogTutorialBubble;
