import { describe, expect, jest } from '@jest/globals';
import { ExtensionBadgeController } from '@project/extension/src/services/extension-badge-controller';

describe('extension badge controller', () => {
    it('shows the global alert while any reason is active and clears it when none is', () => {
        const action = { setBadgeText: jest.fn() };
        const controller = new ExtensionBadgeController(action);

        controller.setGlobalAlert('reasonA', true);
        expect(action.setBadgeText).toHaveBeenLastCalledWith({ text: '!' });

        controller.setGlobalAlert('reasonB', true);
        expect(action.setBadgeText).toHaveBeenLastCalledWith({ text: '!' });

        controller.setGlobalAlert('reasonA', false);
        expect(action.setBadgeText).toHaveBeenLastCalledWith({ text: '!' });

        controller.setGlobalAlert('reasonB', false);
        expect(action.setBadgeText).toHaveBeenLastCalledWith({ text: '' });
    });

    it('does not let one reason turning off clear another active reason', () => {
        const action = { setBadgeText: jest.fn() };
        const controller = new ExtensionBadgeController(action);
        controller.setGlobalAlert('reasonA', true);
        controller.setGlobalAlert('reasonB', true);

        controller.setGlobalAlert('reasonA', false);

        expect(action.setBadgeText).toHaveBeenLastCalledWith({ text: '!' });
    });

    it('sets per-tab alerts and clears the tabs it badged previously', () => {
        const action = { setBadgeText: jest.fn() };
        const controller = new ExtensionBadgeController(action);

        controller.setTabAlerts([1, 2]);
        expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 1, text: '!' });
        expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 2, text: '!' });

        controller.setTabAlerts([2]);
        expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 1, text: '' });
        expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 2, text: '!' });
        expect(action.setBadgeText).not.toHaveBeenCalledWith({ tabId: 2, text: '' });

        controller.setTabAlerts([]);
        expect(action.setBadgeText).toHaveBeenCalledWith({ tabId: 2, text: '' });
    });
});
