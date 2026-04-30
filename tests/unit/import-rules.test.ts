import { describe, it, expect, beforeEach } from 'vitest'
import { useRulesStore } from '@/panel/store/rules-store'
import type { MockRule } from '@/types'

function makeRule(overrides: Partial<MockRule> = {}): MockRule {
  return {
    id: 'test-id-1',
    name: 'Test Rule',
    enabled: true,
    createdAt: 1000,
    updatedAt: 1000,
    match: { urlPattern: '*', urlPatternType: 'glob', methods: [] },
    response: { statusCode: 200, headers: {}, body: '', bodyType: 'json', delayMs: 0 },
    ...overrides,
  }
}

describe('importRules', () => {
  beforeEach(() => {
    useRulesStore.setState({ rules: [], isGloballyEnabled: true })
  })

  // ─── replace mode ──────────────────────────────────────────────────────────

  describe('replace mode', () => {
    it('sets store to exactly the imported rules', () => {
      const imported = [makeRule({ id: 'a', name: 'Rule A' }), makeRule({ id: 'b', name: 'Rule B' })]
      useRulesStore.getState().importRules(imported, 'replace')
      const { rules } = useRulesStore.getState()
      expect(rules).toHaveLength(2)
      expect(rules.map((r) => r.id)).toEqual(['a', 'b'])
    })

    it('preserves original IDs from the file', () => {
      const imported = [makeRule({ id: 'original-id' })]
      useRulesStore.getState().importRules(imported, 'replace')
      expect(useRulesStore.getState().rules[0].id).toBe('original-id')
    })

    it('overwrites all existing rules', () => {
      useRulesStore.setState({ rules: [makeRule({ id: 'existing-1' }), makeRule({ id: 'existing-2' })] })
      useRulesStore.getState().importRules([makeRule({ id: 'new' })], 'replace')
      const { rules } = useRulesStore.getState()
      expect(rules).toHaveLength(1)
      expect(rules[0].id).toBe('new')
    })

    it('clears all rules when given an empty array', () => {
      useRulesStore.setState({ rules: [makeRule(), makeRule({ id: '2' })] })
      useRulesStore.getState().importRules([], 'replace')
      expect(useRulesStore.getState().rules).toHaveLength(0)
    })

    it('preserves rule fields (name, enabled, action, etc.)', () => {
      const imported = [makeRule({ id: 'r1', name: 'Banner', enabled: false, action: 'inject_script' })]
      useRulesStore.getState().importRules(imported, 'replace')
      const rule = useRulesStore.getState().rules[0]
      expect(rule.name).toBe('Banner')
      expect(rule.enabled).toBe(false)
      expect(rule.action).toBe('inject_script')
    })
  })

  // ─── append mode ───────────────────────────────────────────────────────────

  describe('append mode', () => {
    it('adds imported rules on top of existing rules', () => {
      useRulesStore.setState({ rules: [makeRule({ id: 'existing' })] })
      useRulesStore.getState().importRules([makeRule({ id: 'imp-1' }), makeRule({ id: 'imp-2' })], 'append')
      expect(useRulesStore.getState().rules).toHaveLength(3)
    })

    it('existing rules appear first, imported rules are appended', () => {
      useRulesStore.setState({ rules: [makeRule({ id: 'first' })] })
      useRulesStore.getState().importRules([makeRule({ id: 'last' })], 'append')
      const { rules } = useRulesStore.getState()
      expect(rules[0].id).toBe('first')
    })

    it('generates new IDs for imported rules to avoid collisions', () => {
      const imported = [makeRule({ id: 'original-id' })]
      useRulesStore.getState().importRules(imported, 'append')
      expect(useRulesStore.getState().rules[0].id).not.toBe('original-id')
    })

    it('generates unique IDs when multiple rules are imported at once', () => {
      const imported = [makeRule({ id: 'x' }), makeRule({ id: 'x' })]
      useRulesStore.getState().importRules(imported, 'append')
      const ids = useRulesStore.getState().rules.map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('does not modify the IDs of existing rules', () => {
      useRulesStore.setState({ rules: [makeRule({ id: 'keep-me' })] })
      useRulesStore.getState().importRules([makeRule()], 'append')
      expect(useRulesStore.getState().rules[0].id).toBe('keep-me')
    })

    it('updates createdAt and updatedAt on appended rules', () => {
      const before = Date.now()
      useRulesStore.getState().importRules([makeRule({ createdAt: 0, updatedAt: 0 })], 'append')
      const after = Date.now()
      const rule = useRulesStore.getState().rules[0]
      expect(rule.createdAt).toBeGreaterThanOrEqual(before)
      expect(rule.updatedAt).toBeGreaterThanOrEqual(before)
      expect(rule.createdAt).toBeLessThanOrEqual(after)
    })

    it('preserves all other rule fields when appending', () => {
      const imported = [makeRule({ id: 'imp', name: 'CSS Banner', enabled: false, action: 'inject_script' })]
      useRulesStore.getState().importRules(imported, 'append')
      const rule = useRulesStore.getState().rules[0]
      expect(rule.name).toBe('CSS Banner')
      expect(rule.enabled).toBe(false)
      expect(rule.action).toBe('inject_script')
    })

    it('is a no-op on existing rules when given an empty array', () => {
      useRulesStore.setState({ rules: [makeRule({ id: 'kept' })] })
      useRulesStore.getState().importRules([], 'append')
      expect(useRulesStore.getState().rules).toHaveLength(1)
      expect(useRulesStore.getState().rules[0].id).toBe('kept')
    })
  })

  // ─── persistence ───────────────────────────────────────────────────────────

  describe('persistence', () => {
    it('calls chrome.storage.local.set after replace import', () => {
      useRulesStore.getState().importRules([makeRule()], 'replace')
      expect(chrome.storage.local.set).toHaveBeenCalled()
    })

    it('calls chrome.storage.local.set after append import', () => {
      useRulesStore.getState().importRules([makeRule()], 'append')
      expect(chrome.storage.local.set).toHaveBeenCalled()
    })

    it('sends UPDATE_RULES message to background after import', () => {
      useRulesStore.getState().importRules([makeRule()], 'replace')
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'UPDATE_RULES' }),
      )
    })
  })
})
