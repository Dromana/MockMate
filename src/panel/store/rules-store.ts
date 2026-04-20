import { create } from 'zustand'
import { MockRule } from '@/types'
import { generateId } from '@/shared/id-gen'
import { STORAGE_KEYS } from '@/constants'

interface RulesStore {
  rules: MockRule[]
  isGloballyEnabled: boolean
  addRule: (rule: Omit<MockRule, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateRule: (id: string, updates: Partial<MockRule>) => void
  deleteRule: (id: string) => void
  toggleRule: (id: string) => void
  reorderRules: (fromIndex: number, toIndex: number) => void
  setGloballyEnabled: (val: boolean) => void
  loadFromStorage: () => Promise<void>
}

export const useRulesStore = create<RulesStore>((set, get) => ({
  rules: [],
  isGloballyEnabled: true,

  addRule: (ruleData) => {
    const now = Date.now()
    const rule: MockRule = {
      ...ruleData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }
    const rules = [...get().rules, rule]
    set({ rules })
    persistAndSync(rules, get().isGloballyEnabled)
  },

  updateRule: (id, updates) => {
    const rules = get().rules.map((r) =>
      r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r,
    )
    set({ rules })
    persistAndSync(rules, get().isGloballyEnabled)
  },

  deleteRule: (id) => {
    const rules = get().rules.filter((r) => r.id !== id)
    set({ rules })
    persistAndSync(rules, get().isGloballyEnabled)
  },

  toggleRule: (id) => {
    const rules = get().rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled, updatedAt: Date.now() } : r,
    )
    set({ rules })
    persistAndSync(rules, get().isGloballyEnabled)
  },

  reorderRules: (fromIndex, toIndex) => {
    const rules = [...get().rules]
    const [moved] = rules.splice(fromIndex, 1)
    rules.splice(toIndex, 0, moved)
    set({ rules })
    persistAndSync(rules, get().isGloballyEnabled)
  },

  setGloballyEnabled: (isGloballyEnabled) => {
    set({ isGloballyEnabled })
    persistAndSync(get().rules, isGloballyEnabled)
  },

  loadFromStorage: async () => {
    const result = await chrome.storage.local.get([STORAGE_KEYS.RULES, STORAGE_KEYS.GLOBAL_ENABLED])
    set({
      rules: (result[STORAGE_KEYS.RULES] as MockRule[]) ?? [],
      isGloballyEnabled: (result[STORAGE_KEYS.GLOBAL_ENABLED] as boolean) ?? true,
    })
  },
}))

function persistAndSync(rules: MockRule[], isGloballyEnabled: boolean): void {
  chrome.storage.local.set({
    [STORAGE_KEYS.RULES]: rules,
    [STORAGE_KEYS.GLOBAL_ENABLED]: isGloballyEnabled,
  })

  chrome.runtime.sendMessage({
    type: 'UPDATE_RULES',
    rules,
    isGloballyEnabled,
  })
}
