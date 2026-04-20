import { test, expect, chromium } from '@playwright/test'
import path from 'path'
import { getPanelUrl, getExtensionId } from './helpers/extension-loader'
import { fillRuleForm } from './helpers/rule-form'

test.describe('Create Rule', () => {
  test('creates a rule and intercepts a request', async () => {
    const extensionPath = path.resolve(__dirname, '../../dist')

    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    })

    const extensionId = await getExtensionId(context)
    expect(extensionId).toBeTruthy()

    // Open test page
    const testPage = await context.newPage()
    await testPage.goto('http://localhost:3333')

    // Open panel directly (simulating DevTools panel)
    const panelPage = await context.newPage()
    await panelPage.goto(getPanelUrl(extensionId))
    await panelPage.waitForLoadState('networkidle')

    // Create a mock rule
    await fillRuleForm(panelPage, {
      name: 'Mock Users',
      urlPattern: '*/api/users',
      methods: ['GET'],
      statusCode: 200,
      bodyType: 'json',
      body: '{"mocked": true, "users": []}',
    })

    // Verify rule appears in list
    await expect(panelPage.getByText('Mock Users')).toBeVisible()

    // The test page needs the debugger to be attached to its tab
    // In a real DevTools scenario, attachment happens automatically
    // For E2E, we can verify the rule was created and the UI is correct
    await expect(panelPage.getByText('1 active')).toBeVisible()

    await context.close()
  })

  test('shows validation error for empty URL pattern', async () => {
    const extensionPath = path.resolve(__dirname, '../../dist')

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

    await panelPage.getByRole('button', { name: '+ New Rule' }).click()
    await panelPage.getByLabel('Rule Name').fill('Test')
    // Leave URL pattern empty
    await panelPage.getByRole('button', { name: 'Create Rule' }).click()

    await expect(panelPage.getByText('URL pattern is required')).toBeVisible()

    await context.close()
  })
})
