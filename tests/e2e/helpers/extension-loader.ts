import { BrowserContext } from '@playwright/test'

export async function getExtensionId(context: BrowserContext): Promise<string> {
  const page = await context.newPage()
  await page.goto('chrome://extensions')
  await page.waitForTimeout(500)

  const extensionId = await page.evaluate(() => {
    const manager = document.querySelector('extensions-manager')
    const shadowRoot = manager?.shadowRoot
    const itemList = shadowRoot?.querySelector('extensions-item-list')
    const item = itemList?.shadowRoot?.querySelector('extensions-item')
    return item?.getAttribute('id') ?? ''
  })

  await page.close()
  return extensionId
}

export function getPanelUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/src/panel/index.html`
}
