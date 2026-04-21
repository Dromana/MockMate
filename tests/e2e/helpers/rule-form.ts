import { Page } from '@playwright/test'

// ─── Shared interfaces ────────────────────────────────────────────────────────

export interface RuleFormData {
  name: string
  urlPattern: string
  methods?: string[]
  statusCode?: number
  body?: string
  bodyType?: 'json' | 'text' | 'empty'
  delayMs?: number
}

export interface MockResponseRuleData {
  name: string
  urlPattern: string
  methods?: string[]
  statusCode?: number
  body?: string
  bodyType?: 'json' | 'text' | 'empty'
  delayMs?: number
}

export interface MockRequestRuleData {
  name: string
  urlPattern: string
  methods?: string[]
  bodyType?: 'json' | 'text' | 'empty'
  body?: string
}

export interface HeaderMod {
  operation: 'Set' | 'Remove'
  name: string
  value?: string
}

export interface ModifyHeadersRuleData {
  name: string
  urlPattern: string
  methods?: string[]
  requestHeaders?: HeaderMod[]
  responseHeaders?: HeaderMod[]
}

export interface QueryParamMod {
  operation: 'Set' | 'Remove'
  name: string
  value?: string
}

export interface ModifyQueryParamsRuleData {
  name: string
  urlPattern: string
  methods?: string[]
  params?: QueryParamMod[]
}

export interface RedirectRuleData {
  name: string
  urlPattern: string
  methods?: string[]
  from: string
  to: string
  matchType?: 'text' | 'regex'
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function fillBaseFields(page: Page, name: string, urlPattern: string, methods?: string[]): Promise<void> {
  await page.getByLabel('Rule Name').fill(name)
  await page.getByLabel('URL Pattern').fill(urlPattern)
  if (methods && methods.length > 0) {
    for (const method of methods) {
      await page.getByRole('button', { name: method }).click()
    }
  }
}

export async function openNewRuleModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: '+ New Rule' }).click()
}

export async function selectAction(
  page: Page,
  action: 'mock_response' | 'mock_request' | 'modify_headers' | 'modify_query_params' | 'redirect',
): Promise<void> {
  const labelMap: Record<string, string> = {
    mock_response: 'Mock Response',
    mock_request: 'Mock Request',
    modify_headers: 'Modify Headers',
    modify_query_params: 'Query Params',
    redirect: 'Redirect',
  }
  await page.getByRole('button', { name: labelMap[action] }).click()
}

// ─── Action-specific fill functions ──────────────────────────────────────────

export async function fillMockResponseRule(page: Page, data: MockResponseRuleData): Promise<void> {
  await openNewRuleModal(page)
  await fillBaseFields(page, data.name, data.urlPattern, data.methods)

  // Mock Response is the default action; click it explicitly to be safe
  await selectAction(page, 'mock_response')

  // Navigate to the response tab
  await page.getByRole('button', { name: 'response' }).click()

  if (data.statusCode !== undefined) {
    const hasQuickBtn = await page.getByRole('button', { name: String(data.statusCode) }).isVisible()
    if (hasQuickBtn) {
      await page.getByRole('button', { name: String(data.statusCode) }).first().click()
    } else {
      await page.locator('input[type="number"]').fill(String(data.statusCode))
    }
  }

  if (data.bodyType) {
    await page.getByRole('button', { name: data.bodyType }).click()
  }

  if (data.body !== undefined && data.bodyType !== 'empty') {
    await page.locator('textarea').fill(data.body)
  }

  if (data.delayMs !== undefined) {
    await page.locator('input[placeholder*="delay"], input[name*="delay"]').fill(String(data.delayMs))
  }

  await page.getByRole('button', { name: /Create Rule|Save Changes/ }).click()
}

/**
 * Legacy alias kept for backward compatibility with existing specs.
 */
export async function fillRuleForm(page: Page, data: RuleFormData): Promise<void> {
  await fillMockResponseRule(page, data)
}

export async function fillMockRequestRule(page: Page, data: MockRequestRuleData): Promise<void> {
  await openNewRuleModal(page)
  await fillBaseFields(page, data.name, data.urlPattern, data.methods)

  await selectAction(page, 'mock_request')

  // Navigate to the request override tab
  await page.getByRole('button', { name: 'request' }).click()

  if (data.bodyType) {
    await page.getByRole('button', { name: data.bodyType }).click()
  }

  if (data.body !== undefined && data.bodyType !== 'empty') {
    await page.locator('textarea').fill(data.body)
  }

  await page.getByRole('button', { name: /Create Rule|Save Changes/ }).click()
}

export async function fillModifyHeadersRule(page: Page, data: ModifyHeadersRuleData): Promise<void> {
  await openNewRuleModal(page)
  await fillBaseFields(page, data.name, data.urlPattern, data.methods)

  await selectAction(page, 'modify_headers')

  // Navigate to the Headers tab
  await page.getByRole('button', { name: 'Headers' }).click()

  // Request headers
  if (data.requestHeaders && data.requestHeaders.length > 0) {
    for (const mod of data.requestHeaders) {
      await page.getByRole('button', { name: 'Add Header' }).first().click()
      // The new row appears last — locate the last row's controls
      const rows = page.locator('[data-section="request-headers"] [data-row]')
      const row = rows.last()
      await row.getByRole('combobox').selectOption(mod.operation)
      await row.getByPlaceholder('Header name').fill(mod.name)
      if (mod.operation === 'Set' && mod.value !== undefined) {
        await row.getByPlaceholder('Value').fill(mod.value)
      }
    }
  }

  // Response headers
  if (data.responseHeaders && data.responseHeaders.length > 0) {
    for (const mod of data.responseHeaders) {
      await page.getByRole('button', { name: 'Add Header' }).last().click()
      const rows = page.locator('[data-section="response-headers"] [data-row]')
      const row = rows.last()
      await row.getByRole('combobox').selectOption(mod.operation)
      await row.getByPlaceholder('Header name').fill(mod.name)
      if (mod.operation === 'Set' && mod.value !== undefined) {
        await row.getByPlaceholder('Value').fill(mod.value)
      }
    }
  }

  await page.getByRole('button', { name: /Create Rule|Save Changes/ }).click()
}

export async function fillModifyQueryParamsRule(page: Page, data: ModifyQueryParamsRuleData): Promise<void> {
  await openNewRuleModal(page)
  await fillBaseFields(page, data.name, data.urlPattern, data.methods)

  await selectAction(page, 'modify_query_params')

  // Navigate to the Query Params tab
  await page.getByRole('button', { name: 'Query Params' }).click()

  if (data.params && data.params.length > 0) {
    for (const mod of data.params) {
      await page.getByRole('button', { name: 'Add Param' }).click()
      const rows = page.locator('[data-row]')
      const row = rows.last()
      await row.getByRole('combobox').selectOption(mod.operation)
      await row.getByPlaceholder('Param name').fill(mod.name)
      if (mod.operation === 'Set' && mod.value !== undefined) {
        await row.getByPlaceholder('Value').fill(mod.value)
      }
    }
  }

  await page.getByRole('button', { name: /Create Rule|Save Changes/ }).click()
}

export async function fillRedirectRule(page: Page, data: RedirectRuleData): Promise<void> {
  await openNewRuleModal(page)
  await fillBaseFields(page, data.name, data.urlPattern, data.methods)

  await selectAction(page, 'redirect')

  // Navigate to the Redirect tab
  await page.getByRole('button', { name: 'Redirect' }).click()

  if (data.matchType && data.matchType === 'regex') {
    await page.getByRole('button', { name: 'regex' }).click()
  }

  await page.getByPlaceholder('Find').fill(data.from)
  await page.getByPlaceholder('Replace').fill(data.to)

  await page.getByRole('button', { name: /Create Rule|Save Changes/ }).click()
}
