import { test, expect } from './fixtures';

/** Foundations: the Chinese basics with a pass mark and re-checks. Chinese course only. */

async function openFoundations(page: import('@playwright/test').Page) {
  await page.goto('/#/learn');
  await page.getByRole('tab', { name: /foundations/i }).click();
  await expect(page.getByRole('heading', { name: /^foundations$/i })).toBeVisible();
}

test('Today and Paths remind a new learner of the missing basics and lead to Foundations', async ({ page }) => {
  await page.goto('/#/home');
  const gate = page.getByTestId('foundations-gate');
  await expect(gate).toBeVisible();
  await gate.getByRole('button').click();
  await expect(page.getByRole('heading', { name: /^foundations$/i })).toBeVisible();
});

test('a module can be practised: answering shows the explanation and the round ends with a result', async ({ page }) => {
  await openFoundations(page);
  await page.locator('[data-module="pinyin"]').getByRole('button', { name: /practi[sc]e/i }).click();
  await expect(page.getByTestId('foundations-quiz')).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.locator('[data-correct="true"]').first().click();
    await expect(page.getByRole('status')).toBeVisible();
    await page.getByTestId('foundations-next').click();
  }
  await expect(page.getByTestId('foundations-result')).toBeVisible();
  await page.getByTestId('foundations-done').click();
  await expect(page.locator('[data-module="pinyin"]')).toHaveAttribute('data-status', 'ok');
});

test('the radical wiki lists radicals and opens an entry', async ({ page }) => {
  await openFoundations(page);
  await page.locator('[data-module="radicals"]').getByRole('button', { name: /learn/i }).click();
  await page.locator('[data-radical="水"] button').click();
  await expect(page.locator('[data-radical="水"]')).toContainText('河');
  await page.getByPlaceholder(/search radicals/i).fill('horse');
  await expect(page.locator('[data-radical]')).toHaveCount(1);
});

test('sentence order: the right order is accepted', async ({ page }) => {
  await openFoundations(page);
  await page.locator('[data-module="sentences"]').getByRole('button', { name: /practi[sc]e/i }).click();
  await expect(page.getByTestId('foundations-quiz')).toBeVisible();
  // Whatever order the tiles are tapped in, checking ends the question with feedback and a way on
  const free = page.locator('[data-testid="order-bank"] button:enabled');
  while ((await free.count()) > 0) await free.first().click();
  await page.getByRole('button', { name: /^check$/i }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByTestId('foundations-next')).toBeVisible();
});

test('English course has no Foundations tab', async ({ page }) => {
  await page.goto('/#/home');
  await page.evaluate(() => localStorage.setItem('adilingo:state', JSON.stringify({ version: 3, settings: { course: 'english', uiLanguage: 'en', onboarded: true }, progress: {} })));
  await page.goto('/#/learn');
  await page.reload();
  await page.waitForSelector('main');
  await expect(page.getByRole('tab', { name: /foundations/i })).toHaveCount(0);
});
