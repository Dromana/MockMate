import { defineConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const extensionPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dist')

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 1,
  use: {
    browserName: 'chromium',
    headless: false, // Extensions require non-headless in older Playwright; see note below
    launchOptions: {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    },
  },
  webServer: {
    command: 'npx serve tests/e2e/fixtures/test-page -p 3333 --no-clipboard',
    port: 3333,
    reuseExistingServer: true,
  },
})
