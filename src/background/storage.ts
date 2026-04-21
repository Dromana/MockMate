import { MockRule } from '@/types'
import { STORAGE_KEYS } from '@/constants'
import { createLogger } from '@/shared/logger'

const logger = createLogger('storage')

export async function loadRules(): Promise<MockRule[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.RULES)
    return (result[STORAGE_KEYS.RULES] as MockRule[]) ?? []
  } catch (err) {
    logger.error('Failed to load rules', err)
    return []
  }
}

export async function saveRules(rules: MockRule[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.RULES]: rules })
  } catch (err) {
    logger.error('Failed to save rules', err)
  }
}

export async function loadGlobalEnabled(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.GLOBAL_ENABLED)
    return (result[STORAGE_KEYS.GLOBAL_ENABLED] as boolean) ?? true
  } catch {
    return true
  }
}
