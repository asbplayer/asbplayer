import { createRoot } from 'react-dom/client';
import StatisticsOverlayOneUncollectedUi from '@/ui/components/StatisticsOverlayOneUncollectedUi';
import Bridge from '../bridge';

export function renderStatisticsOverlayOneUncollectedUi(element: Element) {
    const bridge = new Bridge();
    createRoot(element).render(<StatisticsOverlayOneUncollectedUi bridge={bridge} />);
    return bridge;
}
