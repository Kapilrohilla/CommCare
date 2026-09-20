import { expect, test } from '@playwright/test'

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/sign-in')
  await page.getByLabel('Password').fill('demo-password')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
}

test('redirects protected routes to sign in', async ({ page }) => {
  await page.goto('/calls')
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible()
})

test('opens the responsive workspace after sign in', async ({ page }) => {
  await page.route('**/calls/dashboard', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          callsToday: { total: 0, byStatus: {} },
          talkTimeSeconds: 0,
          missedCalls: 0,
          extensions: { assigned: 0, total: 0 },
          recentCalls: [],
          asOf: new Date().toISOString(),
        },
      }),
    }),
  )
  await page.route('**/calls/tenant**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { items: [], total: 0 } }),
    }),
  )
  await signIn(page)
  const openNavigation = page.getByRole('button', { name: 'Open navigation' }).first()
  if (await openNavigation.isVisible()) await openNavigation.click()
  await page.getByRole('link', { name: 'Calls', exact: true }).click()
  await expect(page.locator('h1', { hasText: 'Calls' })).toBeVisible()
  const reopenNavigation = page.getByRole('button', { name: 'Open navigation' }).first()
  if (await reopenNavigation.isVisible()) await reopenNavigation.click()
  await page.getByRole('link', { name: 'Dialer', exact: true }).click()
  await expect(page.locator('h1', { hasText: 'Dialer' })).toBeVisible()
})

test('places a successful external call and shows backend acceptance', async ({ page }) => {
  await page.route('**/calls/dashboard', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          callsToday: { total: 0, byStatus: {} },
          talkTimeSeconds: 0,
          missedCalls: 0,
          extensions: null,
          recentCalls: [],
          asOf: new Date().toISOString(),
        },
      }),
    }),
  )
  await page.route('**/tenancy/extension/**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ id: 'ext-1', extension: '201', status: 'available', callerIdName: 'Maya Chen' }],
      }),
    }),
  )
  await page.route('**/calls/click-to-call', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'call-test', status: 'initiated' } }),
    }),
  )
  await page.route('**/calls/call-test', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'call-test', status: 'answered' } }),
    }),
  )

  await signIn(page)
  await page.goto('/dialer')
  await page.getByPlaceholder('+1 415 555 0138').fill('+14155550138')
  await page.getByRole('button', { name: 'Place call' }).click()
  await expect(page.getByText('Call active')).toBeVisible({ timeout: 3000 })
  await expect(page.getByText('Backend status: Answered.')).toBeVisible({ timeout: 3000 })
})

test('shows validation and rejected call errors without locking the form', async ({ page }) => {
  await page.route('**/calls/dashboard', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          callsToday: { total: 0, byStatus: {} },
          talkTimeSeconds: 0,
          missedCalls: 0,
          extensions: null,
          recentCalls: [],
          asOf: new Date().toISOString(),
        },
      }),
    }),
  )
  await page.route('**/tenancy/extension/**', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  )
  await page.route('**/calls/click-to-call', async (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Extension not found: 999' }),
    }),
  )

  await signIn(page)
  await page.goto('/dialer')
  await page.getByRole('button', { name: 'Place call' }).click()
  await expect(page.getByText(/Enter a phone number or extension/i)).toBeVisible()
  await page.getByPlaceholder('+1 415 555 0138').fill('+14155550138')
  await page.getByRole('button', { name: 'Place call' }).click()
  await expect(page.getByText(/Extension not found/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Place call' })).toBeEnabled()
})

test('keeps the desktop sidebar fixed while main content scrolls', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'Fixed rail behavior is a desktop contract')
  await page.route('**/calls/dashboard', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          callsToday: { total: 0, byStatus: {} },
          talkTimeSeconds: 0,
          missedCalls: 0,
          extensions: null,
          recentCalls: [],
          asOf: new Date().toISOString(),
        },
      }),
    }),
  )
  await signIn(page)
  const before = await page.locator('.rail').boundingBox()
  await page.locator('.main-column').evaluate((element) => {
    element.scrollTop = 500
  })
  const after = await page.locator('.rail').boundingBox()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(before?.y).toBe(after?.y)
  expect(overflow).toBe(false)
})
