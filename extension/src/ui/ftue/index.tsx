import { createRoot } from 'react-dom/client';
import FtueUi from '../components/FtueUi';

export function renderFtueUi(element: Element) {
    createRoot(element).render(<FtueUi />);
}
