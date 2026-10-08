import { test, expect } from '@playwright/test';

test.describe('Adilingo App Smoke', () => {
  test('loads home dashboard and navigation successfully', async ({ page }) => {
    await page.goto('/');
    // Check that title or brand exists
    await expect(page).toHaveTitle(/Adilingo/i);
    // Wait for vocab to load and dashboard content to appear
    await expect(page.locator('text=Adilingo').first()).toBeVisible();
    await expect(page.locator('text=Syllabus progress')).toBeVisible();
  });
});

test.describe('Audio speed control', () => {
  for (const course of ['chinese', 'english'] as const) {
    test(`speed can be changed inside a study session (${course})`, async ({ page }) => {
      await page.goto('/');
      if (course === 'english') {
        await page.getByRole('button', { name: /英语 CEFR/ }).first().click();
      }
      await page.getByRole('button', { name: /start today's session|开始今日/i }).first().click();

      const speed = page.getByRole('button', { name: /^(Speed|速度) [\d.]+×/ });
      await expect(speed).toBeVisible();
      await expect(speed).toContainText('1×');

      await speed.click(); // 1 -> 1.5
      await expect(speed).toContainText('1.5×');

      await page.keyboard.press('s'); // 1.5 -> wraps to 0.5
      await expect(speed).toContainText('0.5×');

      // Settings are saved with a 400 ms debounce; wait for it, then confirm the speed survives a reload.
      await page.waitForTimeout(900);
      await page.reload();
      await page.getByRole('button', { name: /start today's session|开始今日/i }).first().click();
      await expect(page.getByRole('button', { name: /^(Speed|速度) [\d.]+×/ })).toContainText('0.5×');
    });
  }
});
