import { createRoot } from 'react-dom/client';
import StatisticsUi from '@project/extension/src/ui/components/StatisticsUi';

export function renderStatisticsUi(element: Element) {
    createRoot(element).render(<StatisticsUi />);
}
