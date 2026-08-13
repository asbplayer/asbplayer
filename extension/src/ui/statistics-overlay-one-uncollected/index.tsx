import { createRoot } from 'react-dom/client';
import StatisticsOverlayOneUncollectedUi from '@/ui/components/StatisticsOverlayOneUncollectedUi';
import Bridge from '@project/extension/src/ui/bridge';

export function renderStatisticsOverlayOneUncollectedUi(element: Element) {
    const bridge = new Bridge();
    createRoot(element).render(<StatisticsOverlayOneUncollectedUi bridge={bridge} />);
    return bridge;
}
