import TutorialBubble from '@project/common/components/TutorialBubble';
import Link from '@mui/material/Link';
import { Trans } from 'react-i18next';

const NoteTypeTutorialBubble: React.FC<{
    noNoteTypes: boolean;
    show: boolean;
    disabled: boolean;
    onCreateDefaultNoteType: () => void;
    children: React.ReactElement;
}> = ({ noNoteTypes, show, disabled, children, onCreateDefaultNoteType }) => {
    return (
        <TutorialBubble
            show={show}
            placement="bottom"
            disabled={disabled}
            text={
                <>
                    <Trans i18nKey="ftue.noteType" components={[<b key={0}>Note Type</b>, <b key={1}>Note Type</b>]} />
                    {noNoteTypes && (
                        <>
                            <p />
                            <Trans
                                i18nKey="ftue.defaultNoteType"
                                components={[
                                    <Link key={0} href={'#'} onClick={onCreateDefaultNoteType}>
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

export default NoteTypeTutorialBubble;
