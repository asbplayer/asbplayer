import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsUi from '../components/SettingsUi';

export const renderSettingsUi = (element: Element) => {
    createRoot(element).render(<SettingsUi />);
};
