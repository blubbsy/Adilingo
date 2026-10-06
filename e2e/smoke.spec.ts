import { test, expect } from '@playwright/test';

test.describe('Hànzì Flow App Smoke', () => {
  test('loads home dashboard and navigation successfully', async ({ page }) => {
    await page.goto('/');
    // Check that title or brand exists
    await expect(page).toHaveTitle(/Hànzì Flow/i);
    // Wait for vocab to load and dashboard content to appear
    await expect(page.locator('text=Hànzì Flow').first()).toBeVisible();
    await expect(page.locator('text=Syllabus progress')).toBeVisible();
  });
});
