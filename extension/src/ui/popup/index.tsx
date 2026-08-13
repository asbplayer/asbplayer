import { createRoot } from 'react-dom/client';
import { PopupUi } from '@project/extension/src/ui/components/PopupUi';
import { AsbplayerSettings } from '@project/common/settings';

export interface PopupUiParameters {
    currentSettings: AsbplayerSettings;
    commands: any;
}

export async function renderPopupUi(element: Element, { commands }: PopupUiParameters) {
    createRoot(element).render(<PopupUi commands={commands} />);
}
