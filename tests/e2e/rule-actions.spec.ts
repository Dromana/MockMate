import { test, expect } from './helpers/fixtures'
import {
  openNewRuleModal,
  selectAction,
  fillMockRequestRule,
  fillModifyHeadersRule,
  fillModifyQueryParamsRule,
  fillRedirectRule,
} from './helpers/rule-form'

test.describe('Rule actions', () => {
  test('create a mock_request rule and verify it appears in the list', async ({ panelPage }) => {
    await fillMockRequestRule(panelPage, {
      name: 'Mock Request Override',
      urlPattern: '*/api/data',
      methods: ['POST'],
      bodyType: 'json',
      body: '{"overridden": true}',
    })

    await expect(panelPage.getByText('Mock Request Override')).toBeVisible()
  })

  test('create a modify_headers rule — request set + response remove — verify in list', async ({ panelPage }) => {
    await openNewRuleModal(panelPage)
    await panelPage.getByLabel('Rule Name').fill('Add Auth Header')
    await panelPage.getByLabel('URL Pattern').fill('*/api/secure')

    await selectAction(panelPage, 'modify_headers')
    await panelPage.getByRole('button', { name: 'Headers' }).click()

    // Add a Set request header
    await panelPage.getByRole('button', { name: 'Add Header' }).first().click()
    // Fill the last-added row in the request headers section
    const reqRows = panelPage.locator('[data-section="request-headers"] [data-row]')
    await reqRows.last().getByRole('combobox').selectOption('Set')
    await reqRows.last().getByPlaceholder('Header name').fill('x-api-key')
    await reqRows.last().getByPlaceholder('Value').fill('secret-key')

    // Add a Remove response header
    await panelPage.getByRole('button', { name: 'Add Header' }).last().click()
    const resRows = panelPage.locator('[data-section="response-headers"] [data-row]')
    await resRows.last().getByRole('combobox').selectOption('Remove')
    await resRows.last().getByPlaceholder('Header name').fill('x-powered-by')

    await panelPage.getByRole('button', { name: /Create Rule|Save Changes/ }).click()

    await expect(panelPage.getByText('Add Auth Header')).toBeVisible()
  })

  test('create a modify_query_params rule — set + remove — verify in list', async ({ panelPage }) => {
    await openNewRuleModal(panelPage)
    await panelPage.getByLabel('Rule Name').fill('Inject Debug Param')
    await panelPage.getByLabel('URL Pattern').fill('*/api/feed')

    await selectAction(panelPage, 'modify_query_params')
    await panelPage.getByRole('button', { name: 'Query Params' }).click()

    // Add a Set param
    await panelPage.getByRole('button', { name: 'Add Param' }).click()
    const rows = panelPage.locator('[data-row]')
    await rows.last().getByRole('combobox').selectOption('Set')
    await rows.last().getByPlaceholder('Param name').fill('debug')
    await rows.last().getByPlaceholder('Value').fill('true')

    // Add a Remove param
    await panelPage.getByRole('button', { name: 'Add Param' }).click()
    const rowsAfter = panelPage.locator('[data-row]')
    await rowsAfter.last().getByRole('combobox').selectOption('Remove')
    await rowsAfter.last().getByPlaceholder('Param name').fill('offset')

    await panelPage.getByRole('button', { name: /Create Rule|Save Changes/ }).click()

    await expect(panelPage.getByText('Inject Debug Param')).toBeVisible()
  })

  test('create a redirect rule — fill from/to, verify live preview updates, verify in list', async ({ panelPage }) => {
    await openNewRuleModal(panelPage)
    await panelPage.getByLabel('Rule Name').fill('Redirect Staging to Prod')
    await panelPage.getByLabel('URL Pattern').fill('*staging.example.com*')

    await selectAction(panelPage, 'redirect')
    await panelPage.getByRole('button', { name: 'Redirect' }).click()

    await panelPage.getByPlaceholder('Find').fill('staging.example.com')
    await panelPage.getByPlaceholder('Replace').fill('prod.example.com')

    // The live preview should reflect the substitution
    await expect(panelPage.getByText('prod.example.com')).toBeVisible()

    await panelPage.getByRole('button', { name: /Create Rule|Save Changes/ }).click()

    await expect(panelPage.getByText('Redirect Staging to Prod')).toBeVisible()
  })
})
