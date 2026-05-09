import { createRoot } from 'react-dom/client';
import StatisticsUi from '../components/StatisticsUi';

export function renderStatisticsUi(element: Element) {
    createRoot(element).render(<StatisticsUi />);
}
