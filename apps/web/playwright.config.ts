import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
	testDir: './e2e',
	timeout: 30_000,
	expect: {
		timeout: 5_000,
	},
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173',
		trace: 'on-first-retry',
		video: 'retain-on-failure',
		screenshot: 'only-on-failure',
		headless: true,
	},
	projects: [
		{
			name: isCI ? 'chromium' : 'chrome',
			use: {
				...devices['Desktop Chrome'],
				...(isCI ? { browserName: 'chromium' as const } : { channel: 'chrome' as const }),
			},
		},
	],
});
