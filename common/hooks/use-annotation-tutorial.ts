import { useEffect, useCallback, useState } from 'react';
import { AnnotationTutorialState, GlobalStateProvider } from '@project/common/global-state';

export const useAnnotationTutorial = ({ globalStateProvider }: { globalStateProvider: GlobalStateProvider }) => {
    const handleAnnotationTutorialSeen = useCallback(() => {
        globalStateProvider.set({ ftueAnnotation: AnnotationTutorialState.hasSeen });
        setInAnnotationTutorial(false);
    }, [globalStateProvider]);
    const [inAnnotationTutorial, setInAnnotationTutorial] = useState<boolean>(false);
    useEffect(() => {
        globalStateProvider
            .get(['ftueAnnotation'])
            .then((s) => setInAnnotationTutorial(s.ftueAnnotation === AnnotationTutorialState.shouldSee));
    }, [globalStateProvider]);
    return { handleAnnotationTutorialSeen, inAnnotationTutorial };
};
