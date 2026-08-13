import { createRoot } from 'react-dom/client';
import MobileVideoOverlayUi from '@project/extension/src/ui/components/MobileVideoOverlayUi';

export async function renderMobileVideoOverlay(element: Element) {
    createRoot(element).render(<MobileVideoOverlayUi />);
}
