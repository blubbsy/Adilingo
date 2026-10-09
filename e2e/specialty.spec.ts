import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 } });

async function openCatalogue(page: Page) {
  await page.getByTestId('open-catalogue').click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('Specialty courses', () => {
  test('start a specialty course from the catalogue, study, and return to the language course untouched', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Syllabus progress')).toBeVisible();

    await openCatalogue(page);
    await page.locator('[data-course="chinese:emotor"]').click();

    // The specialty course has its own screens: no learning paths / grammar, but topics and dictionary
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('button', { name: /Learn|学习/ })).toHaveCount(0);
    await expect(page.getByText('Essentials').first()).toBeVisible();

    await page.getByRole('button', { name: /start today's session|开始今日/i }).first().click();
    await expect(page.getByRole('button', { name: /End session|结束/ })).toBeVisible();
    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
    await page.getByRole('button', { name: /End session|结束/ }).click();

    // Unreachable language-course screens redirect
    await page.goto('/#/grammar');
    await expect(page.locator('text=Irregular')).toHaveCount(0);

    // Back to the plain Chinese course: its own dashboard, nothing from the specialty course
    await page.locator('[data-course="chinese"]').first().click();
    await expect(page.locator('text=Syllabus progress')).toBeVisible();
    await expect(page.getByText('Essentials')).toHaveCount(0);
  });

  test('English terms of a domain are studied with the English course machinery', async ({ page }) => {
    await page.goto('/');
    await openCatalogue(page);
    await page.locator('[data-course="english:power-electronics"]').click();
    await page.goto('/#/dictionary');
    await page.getByRole('searchbox').or(page.getByRole('textbox')).first().fill('IGBT');
    const hit = page.getByText(/insulated-gate bipolar transistor/i).first();
    await expect(hit).toBeVisible();
    await hit.click();
    // The answer side shows the definition and the abbreviation
    await expect(page.getByText(/Definition · Abbreviation: IGBT/).first()).toBeVisible();
  });
});

test.describe('Topic vocabulary size', () => {
  test('topic packs are large in both courses', async ({ page }) => {
    await page.goto('/#/topics');
    await expect(page.locator('[data-pack-words]').first()).toBeVisible();
    // Every pack card shows its word count; none of the curated packs is tiny
    const counts = await page.locator('[data-pack-words]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-pack-words'))));
    expect(counts.length).toBeGreaterThanOrEqual(15);
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(100);
  });
});

test.describe('Chinese grammar wiki', () => {
  test('search, open an article, jump to a lesson and back', async ({ page }) => {
    await page.goto('/#/learn');
    await page.getByRole('tab', { name: /Wiki|语法百科/ }).click();
    const search = page.getByRole('searchbox');
    await search.fill('了');
    const first = page.locator('[data-article]').first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page.locator('[data-wiki-article]')).toBeVisible();

    const lesson = page.locator('[data-lesson]').first();
    await lesson.click();
    await expect(page.locator('[data-wiki-article]')).toHaveCount(0);
    await page.getByRole('button', { name: /Back to the wiki article|返回百科文章/ }).click();
    await expect(page.locator('[data-wiki-article]')).toBeVisible();
  });

  test('the English course has no wiki', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-course="english"]').first().click();
    await page.goto('/#/learn');
    await expect(page.getByRole('tab', { name: /Wiki|语法百科/ })).toHaveCount(0);
  });
});
