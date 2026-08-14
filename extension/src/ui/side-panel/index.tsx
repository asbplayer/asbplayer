import { createRoot } from 'react-dom/client';
import SidePanelUi from '../components/SidePanelUi';

export function renderSidePanelUi(element: Element) {
    createRoot(element).render(<SidePanelUi />);
}
