import { expect } from '@playwright/test';
import { test } from '../fixtures/extension';
import { mineSubtitle } from '../scenarios/mine-subtitle';
import { FIRST_SUBTITLE } from '../fixtures/paths';

test('mining opens the Anki dialog prefilled with the current subtitle', async ({ ext }) => {
    const { anki } = await mineSubtitle(ext);

    await expect(anki.getByRole('textbox', { name: 'Sentence' })).toHaveValue(FIRST_SUBTITLE);
    await expect(anki.getByRole('textbox', { name: 'Definition' })).toBeEditable();
    await expect(anki.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
});
