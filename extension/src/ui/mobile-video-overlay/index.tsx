import { createRoot } from 'react-dom/client';
import MobileVideoOverlayUi from '../components/MobileVideoOverlayUi';

export async function renderMobileVideoOverlay(element: Element) {
    createRoot(element).render(<MobileVideoOverlayUi />);
}
