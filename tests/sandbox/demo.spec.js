import { test, expect } from '@playwright/test';
test('deployed-path sandbox is labeled, persists locally, renders text safely, and approves a request', async ({
  page,
}) => {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto('./');
  await expect(
    page.getByText('Portfolio sandbox · Everything you do stays in this browser.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Explore as a guest' }).click();
  await expect(page.getByRole('heading', { name: 'A little more connected.' })).toBeVisible();
  await expect(page.locator('.post-image').first()).toBeVisible();
  expect(
    await page
      .locator('.post-image')
      .first()
      .evaluate((image) => image.complete && image.naturalWidth > 0),
  ).toBe(true);
  await page
    .getByRole('textbox', { name: 'What would you like to share?' })
    .fill('<img src=x onerror=alert(1)> A safe little thought.');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const post = page.getByRole('article').filter({ hasText: 'A safe little thought.' });
  await expect(post).toBeVisible();
  await expect(post.locator('img[src=x]')).toHaveCount(0);
  await post.getByRole('button', { name: 'Bookmark post', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('article').filter({ hasText: 'A safe little thought.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: /^Requests/ }).click();
  await expect(page.getByText('@danielp wants to follow you')).toBeVisible();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'All caught up.' })).toBeVisible();
  await page.getByRole('link', { name: 'My profile', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out of your profile' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  expect(failures).toEqual([]);
});
