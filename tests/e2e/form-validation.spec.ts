import { test, expect } from './helpers/fixtures'
import { openNewRuleModal } from './helpers/rule-form'

test.describe('Form validation', () => {
  test('submitting empty form shows both name and URL pattern errors', async ({ panelPage }) => {
    await openNewRuleModal(panelPage)

    // Submit with nothing filled in
    await panelPage.getByRole('button', { name: 'Create Rule' }).click()

    await expect(panelPage.getByText('Name is required')).toBeVisible()
    await expect(panelPage.getByText('URL pattern is required')).toBeVisible()
  })

  test('filling name only shows URL pattern required error', async ({ panelPage }) => {
    await openNewRuleModal(panelPage)

    await panelPage.getByLabel('Rule Name').fill('My Rule')
    // Leave URL pattern empty
    await panelPage.getByRole('button', { name: 'Create Rule' }).click()

    await expect(panelPage.getByText('URL pattern is required')).toBeVisible()
    await expect(panelPage.getByText('Name is required')).not.toBeVisible()
  })

  test('invalid JSON body shows validation error', async ({ panelPage }) => {
    await openNewRuleModal(panelPage)

    await panelPage.getByLabel('Rule Name').fill('JSON Validation Test')
    await panelPage.getByLabel('URL Pattern').fill('*/api/test')

    // Navigate to the response tab and select JSON body type
    await panelPage.getByRole('button', { name: 'response' }).click()
    await panelPage.getByRole('button', { name: 'json' }).click()

    // Enter invalid JSON
    await panelPage.locator('textarea').fill('{invalid json}')

    await panelPage.getByRole('button', { name: 'Create Rule' }).click()

    await expect(panelPage.getByText('Invalid JSON')).toBeVisible()
  })

  test('status code below 100 shows validation error', async ({ panelPage }) => {
    await openNewRuleModal(panelPage)

    await panelPage.getByLabel('Rule Name').fill('Status Code Test')
    await panelPage.getByLabel('URL Pattern').fill('*/api/test')

    await panelPage.getByRole('button', { name: 'response' }).click()

    // Type a status code below the minimum
    await panelPage.locator('input[type="number"]').fill('99')

    await panelPage.getByRole('button', { name: 'Create Rule' }).click()

    // The form should surface a status code validation error
    const errorLocator = panelPage.getByText(/status|must be|invalid/i)
    await expect(errorLocator).toBeVisible()
  })

  test('fixing errors and resubmitting creates the rule successfully', async ({ panelPage }) => {
    await openNewRuleModal(panelPage)

    // First attempt — leave both fields empty
    await panelPage.getByRole('button', { name: 'Create Rule' }).click()
    await expect(panelPage.getByText('Name is required')).toBeVisible()
    await expect(panelPage.getByText('URL pattern is required')).toBeVisible()

    // Fix name
    await panelPage.getByLabel('Rule Name').fill('Fixed Rule')

    // Fix URL pattern
    await panelPage.getByLabel('URL Pattern').fill('*/api/fixed')

    // Second attempt — should succeed
    await panelPage.getByRole('button', { name: 'Create Rule' }).click()

    await expect(panelPage.getByText('Fixed Rule')).toBeVisible()
    // Error messages should be gone
    await expect(panelPage.getByText('Name is required')).not.toBeVisible()
    await expect(panelPage.getByText('URL pattern is required')).not.toBeVisible()
  })
})
