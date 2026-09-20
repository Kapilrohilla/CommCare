import { expect, test } from '@playwright/test'

test('redirects protected routes to sign in', async ({ page }) => {
    await page.goto('/calls')
    await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible()
})

test('opens the responsive workspace after sign in', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByLabel('Password').fill('demo-password')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
    const openNavigation = page.getByRole('button', { name: 'Open navigation' })
    if (await openNavigation.isVisible()) await openNavigation.click()
    await page.getByRole('link', { name: 'Call activity' }).click()
    await expect(page.locator('h1', { hasText: 'Call activity' })).toBeVisible()
    await page.getByPlaceholder('Enter number or extension').fill('204')
    await page.getByRole('button', { name: 'Call', exact: true }).click()
    await expect(page.getByText('Calling 204...')).toBeVisible({ timeout: 2000 })
})
