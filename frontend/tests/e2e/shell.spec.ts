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
    const openNavigation = page.getByRole('button', { name: 'Open navigation' }).first()
    if (await openNavigation.isVisible()) await openNavigation.click()
    await page.getByRole('link', { name: 'Calls', exact: true }).click()
    await expect(page.locator('h1', { hasText: 'Calls' })).toBeVisible()
    const reopenNavigation = page.getByRole('button', { name: 'Open navigation' }).first()
    if (await reopenNavigation.isVisible()) await reopenNavigation.click()
    await page.getByRole('link', { name: 'Dialer', exact: true }).click()
    await expect(page.locator('h1', { hasText: 'Dialer' })).toBeVisible()
    await page.route('**/calls/click-to-call', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'call-test', status: 'initiated' } }) }))
    await page.getByPlaceholder('+1 415 555 0138').fill('+14155550138')
    await page.getByRole('button', { name: 'Place call' }).click()
    await expect(page.getByText(/backend accepted the call/)).toBeVisible({ timeout: 2000 })
})

test('keeps the desktop sidebar fixed while main content scrolls', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'Fixed rail behavior is a desktop contract')
    await page.goto('/sign-in')
    await page.getByLabel('Password').fill('demo-password')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
    const before = await page.locator('.rail').boundingBox()
    await page.locator('.main-column').evaluate((element) => { element.scrollTop = 500 })
    const after = await page.locator('.rail').boundingBox()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(before?.y).toBe(after?.y)
    expect(overflow).toBe(false)
})
