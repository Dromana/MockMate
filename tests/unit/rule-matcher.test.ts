import { describe, it, expect } from 'vitest'
import { findMatchingRule } from '@/background/rule-matcher'
import { MockRule } from '@/types'

function makeRule(overrides: Partial<MockRule> = {}): MockRule {
  return {
    id: '1',
    name: 'Test Rule',
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    match: {
      urlPattern: '*/api/users',
      urlPatternType: 'glob',
      methods: [],
      ...overrides.match,
    },
    response: {
      statusCode: 200,
      headers: {},
      body: '{}',
      bodyType: 'json',
      delayMs: 0,
      ...overrides.response,
    },
    ...overrides,
  }
}

describe('findMatchingRule', () => {
  it('returns null for empty rules', () => {
    expect(findMatchingRule({ url: 'https://api.example.com/users', method: 'GET' }, [])).toBeNull()
  })

  it('matches on URL glob and any method', () => {
    const rule = makeRule()
    expect(findMatchingRule({ url: 'https://api.example.com/api/users', method: 'GET' }, [rule])).toBe(rule)
  })

  it('skips disabled rules', () => {
    const rule = makeRule({ enabled: false })
    expect(findMatchingRule({ url: 'https://api.example.com/api/users', method: 'GET' }, [rule])).toBeNull()
  })

  it('matches first rule (priority order)', () => {
    const rule1 = makeRule({ id: '1', response: { statusCode: 200, headers: {}, body: '', bodyType: 'json', delayMs: 0 } })
    const rule2 = makeRule({ id: '2', response: { statusCode: 404, headers: {}, body: '', bodyType: 'json', delayMs: 0 } })
    const result = findMatchingRule({ url: 'https://api.example.com/api/users', method: 'GET' }, [rule1, rule2])
    expect(result?.id).toBe('1')
  })

  it('filters by HTTP method', () => {
    const rule = makeRule({ match: { urlPattern: '*/api/users', urlPatternType: 'glob', methods: ['POST'] } })
    expect(findMatchingRule({ url: 'https://api.example.com/api/users', method: 'GET' }, [rule])).toBeNull()
    expect(findMatchingRule({ url: 'https://api.example.com/api/users', method: 'POST' }, [rule])).toBe(rule)
  })

  it('matches on request header (exact)', () => {
    const rule = makeRule({
      match: {
        urlPattern: '*',
        urlPatternType: 'glob',
        methods: [],
        requestHeaders: [{ name: 'x-mock', value: 'true', matchType: 'exact' }],
      },
    })
    expect(findMatchingRule(
      { url: 'https://api.example.com/any', method: 'GET', requestHeaders: [{ name: 'x-mock', value: 'true' }] },
      [rule],
    )).toBe(rule)

    expect(findMatchingRule(
      { url: 'https://api.example.com/any', method: 'GET', requestHeaders: [] },
      [rule],
    )).toBeNull()
  })
})
