import { test as base, chromium, Page } from '@playwright/test'
import path from 'path'
import { getExtensionId, getPanelUrl } from './extension-loader'

export interface MockMateFixtures {
  panelPage: Page
  testPage: Page
}

export const test = base.extend<MockMateFixtures>({
  // eslint-disable-next-line no-empty-pattern
  panelPage: async ({}, use) => {
    const extensionPath = path.resolve(__dirname, '../../../dist')

    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    })

    const extensionId = await getExtensionId(context)

    const panelPage = await context.newPage()
    await panelPage.goto(getPanelUrl(extensionId))
    await panelPage.waitForLoadState('networkidle')

    await use(panelPage)

    await context.close()
  },

  testPage: async ({ panelPage }, use) => {
    const context = panelPage.context()
    const testPage = await context.newPage()
    await testPage.goto('http://localhost:3333')
    await testPage.waitForLoadState('domcontentloaded')

    await use(testPage)

    await testPage.close()
  },
})

export { expect } from '@playwright/test'
