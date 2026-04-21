import { test, expect, chromium } from '@playwright/test'
import path from 'path'
import { getPanelUrl, getExtensionId } from './helpers/extension-loader'
import { fillRuleForm } from './helpers/rule-form'

test('rules persist after reloading the panel', async () => {
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
  await panelPage.waitForLoadState('networkidle')

  // Create a rule
  await fillRuleForm(panelPage, {
    name: 'Persistent Rule',
    urlPattern: '*/api/persistent',
    statusCode: 202,
    bodyType: 'json',
    body: '{"persisted": true}',
  })

  await expect(panelPage.getByText('Persistent Rule')).toBeVisible()

  // Reload the panel
  await panelPage.reload()
  await panelPage.waitForLoadState('networkidle')

  // Rule should still be there
  await expect(panelPage.getByText('Persistent Rule')).toBeVisible()

  await context.close()
})
