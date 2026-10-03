import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('guest can post, like, comment, bookmark, and edit a profile without creating an account', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore as a guest' }).click();
  await expect(page.getByRole('heading', { name: 'A little more connected.' })).toBeVisible();
  await page
    .getByRole('textbox', { name: 'What would you like to share?' })
    .fill('Browser-tested small win 🌱');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const post = page.getByRole('article').filter({ hasText: 'Browser-tested small win' });
  await expect(post).toBeVisible();
  await post.getByRole('button', { name: 'Like post', exact: true }).click();
  await expect(post.getByRole('button', { name: 'Unlike post', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await post.getByRole('button', { name: 'Bookmark post', exact: true }).click();
  await post.getByRole('button', { name: 'Read and add comments' }).click();
  await post.getByRole('textbox', { name: 'Your comment' }).fill('And the conversation works too.');
  await post.getByRole('button', { name: 'Post comment' }).click();
  await expect(post.getByText('And the conversation works too.')).toBeVisible();
  await page.getByRole('link', { name: 'Bookmarks', exact: true }).click();
  await expect(
    page.getByRole('article').filter({ hasText: 'Browser-tested small win' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'My profile', exact: true }).click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Alex Builder');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Alex Builder' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Alex Builder' })).toBeVisible();
});
test('desktop feed has accessible controls and no serious accessibility violations', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/');
  const authResults = await new AxeBuilder({ page }).analyze();
  expect(
    authResults.violations.filter((item) => ['critical', 'serious'].includes(item.impact)),
  ).toEqual([]);
  await page.screenshot({ path: 'docs/screenshots/sign-in.png' });
  await page.getByRole('button', { name: 'Explore as a guest' }).click();
  await expect(page.getByRole('article').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Good people to know' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) => ['critical', 'serious'].includes(item.impact)),
  ).toEqual([]);
  await expect(page.locator('#toast')).not.toHaveClass(/visible/);
  await page.screenshot({ path: 'docs/screenshots/feed-desktop.png', fullPage: false });
});
test('mobile feed stays within the viewport and has working navigation, search, and image composer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore as a guest' }).click();
  await expect(page.getByRole('heading', { name: 'A little more connected.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#toast')).not.toHaveClass(/visible/);
  await page.screenshot({ path: 'docs/screenshots/feed-mobile.png', fullPage: false });
  await page.getByRole('button', { name: 'Add a photo' }).click();
  await expect(page.getByRole('textbox', { name: 'Image URL', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Good company starts here.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search posts or people' }).fill('Maya');
  await page.getByRole('textbox', { name: 'Search posts or people' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Maya Chen' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((item) => ['critical', 'serious'].includes(item.impact)),
  ).toEqual([]);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
