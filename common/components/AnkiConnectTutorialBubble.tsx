import TutorialBubble from '@project/common/components/TutorialBubble';
import Link from '@mui/material/Link';
import { Trans } from 'react-i18next';

const AnkiConnectTutorialBubble: React.FC<{
    show: boolean;
    disabled: boolean;
    ankiConnectUrlError: boolean;
    children: React.ReactElement;
    onConfirm: () => void;
}> = ({ show, disabled, ankiConnectUrlError, children, onConfirm }) => {
    return (
        <TutorialBubble
            show={show}
            disabled={disabled}
            placement="bottom"
            text={
                <>
                    <Trans
                        i18nKey="ftue.ankiConnect"
                        components={[
                            <Link key={0} href="https://ankiweb.net/shared/info/2055492159" target="_blank">
                                AnkiConnect
                            </Link>,
                            <Link key={1} href="https://apps.ankiweb.net/" target="_blank">
                                Anki
                            </Link>,
                        ]}
                    />
                    {ankiConnectUrlError && (
                        <>
                            <p />
                            <Trans i18nKey="ftue.ankiConnectError" />
                        </>
                    )}
                </>
            }
            onConfirm={onConfirm}
        >
            {children}
        </TutorialBubble>
    );
};

export default AnkiConnectTutorialBubble;
