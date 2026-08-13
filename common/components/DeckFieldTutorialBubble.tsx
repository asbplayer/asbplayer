import TutorialBubble from '@project/common/components/TutorialBubble';
import Link from '@mui/material/Link';
import { Trans } from 'react-i18next';

const DeckFieldTutorialBubble: React.FC<{
    noDecks: boolean;
    show: boolean;
    disabled: boolean;
    onCreateDefaultDeck: () => void;
    children: React.ReactElement;
}> = ({ noDecks, show, disabled, children, onCreateDefaultDeck }) => {
    return (
        <TutorialBubble
            show={show}
            placement="bottom"
            disabled={disabled}
            text={
                <>
                    <Trans i18nKey="ftue.deck" components={[<b key={0}>Deck</b>]} />
                    {noDecks && (
                        <>
                            <p />
                            <Trans
                                i18nKey="ftue.defaultDeck"
                                components={[
                                    <Link key={0} href={'#'} onClick={onCreateDefaultDeck}>
                                        create the default one
                                    </Link>,
                                ]}
                            />
                        </>
                    )}
                </>
            }
        >
            {children}
        </TutorialBubble>
    );
};

export default DeckFieldTutorialBubble;
