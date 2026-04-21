import path from 'path'
import { chromium } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { fillMockResponseRule, openNewRuleModal } from './helpers/rule-form'

test.describe('Rule management', () => {
  test('edit an existing rule — change name and URL pattern, save, verify updated', async ({ panelPage }) => {
    // Create the rule we will later edit
    await fillMockResponseRule(panelPage, {
      name: 'Original Rule',
      urlPattern: '*/api/original',
      statusCode: 200,
      bodyType: 'json',
      body: '{"original": true}',
    })

    await expect(panelPage.getByText('Original Rule')).toBeVisible()

    // Click the edit button on the rule row
    await panelPage.getByText('Original Rule').locator('..').getByRole('button', { name: /edit|pencil/i }).click()

    // Clear and retype the rule name
    await panelPage.getByLabel('Rule Name').clear()
    await panelPage.getByLabel('Rule Name').fill('Updated Rule')

    // Clear and retype the URL pattern
    await panelPage.getByLabel('URL Pattern').clear()
    await panelPage.getByLabel('URL Pattern').fill('*/api/updated')

    // Save
    await panelPage.getByRole('button', { name: /Save Changes/ }).click()

    // Updated name visible
    await expect(panelPage.getByText('Updated Rule')).toBeVisible()
    // Old name gone
    await expect(panelPage.getByText('Original Rule')).not.toBeVisible()
  })

  test('delete a rule — create it, delete it, verify it is gone', async ({ panelPage }) => {
    await fillMockResponseRule(panelPage, {
      name: 'Rule To Delete',
      urlPattern: '*/api/delete-me',
      statusCode: 204,
      bodyType: 'empty',
    })

    await expect(panelPage.getByText('Rule To Delete')).toBeVisible()

    // Click delete/trash button on the rule row
    await panelPage.getByText('Rule To Delete').locator('..').getByRole('button', { name: /delete|trash/i }).click()

    // Confirm deletion if a dialog appears
    const confirmBtn = panelPage.getByRole('button', { name: /confirm|yes|delete/i })
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
    }

    await expect(panelPage.getByText('Rule To Delete')).not.toBeVisible()
  })

  test('toggle a rule enabled/disabled — verify visual indicator changes', async ({ panelPage }) => {
    await fillMockResponseRule(panelPage, {
      name: 'Toggle Rule',
      urlPattern: '*/api/toggle',
      statusCode: 200,
      bodyType: 'json',
      body: '{"toggled": true}',
    })

    await expect(panelPage.getByText('Toggle Rule')).toBeVisible()

    const ruleRow = panelPage.getByText('Toggle Rule').locator('..')

    // The toggle should show the rule as enabled initially
    const toggle = ruleRow.getByRole('checkbox').or(ruleRow.getByRole('switch'))
    const isCheckedBefore = await toggle.isChecked()
    expect(isCheckedBefore).toBe(true)

    // Toggle to disabled
    await toggle.click()

    const isCheckedAfter = await toggle.isChecked()
    expect(isCheckedAfter).toBe(false)

    // Toggle back to enabled
    await toggle.click()

    const isCheckedFinal = await toggle.isChecked()
    expect(isCheckedFinal).toBe(true)
  })
})
