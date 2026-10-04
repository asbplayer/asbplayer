import { createRoot } from 'react-dom/client';
import StatisticsOverlayUi from '@/ui/components/StatisticsOverlayUi';

export function renderStatisticsOverlayUi(element: Element) {
    createRoot(element).render(<StatisticsOverlayUi />);
}
