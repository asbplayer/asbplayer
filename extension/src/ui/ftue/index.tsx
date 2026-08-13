import { createRoot } from 'react-dom/client';
import FtueUi from '@project/extension/src/ui/components/FtueUi';

export function renderFtueUi(element: Element) {
    createRoot(element).render(<FtueUi />);
}
