import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './tests/e2e',
    webServer: {
        command: 'pnpm dev --host 127.0.0.1 --port 5173',
        port: 5173,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    use: { baseURL: 'http://127.0.0.1:5173', trace: 'on-first-retry' },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['iPhone 13'] } },
    ],
})
