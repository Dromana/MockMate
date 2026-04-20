import { describe, it, expect } from 'vitest'
import { matchesPattern } from '@/shared/url-pattern'

describe('matchesPattern - glob', () => {
  it('matches exact URL with wildcard', () => {
    expect(matchesPattern('https://api.example.com/users', '*/users', 'glob')).toBe(true)
  })

  it('matches with double wildcard across segments', () => {
    expect(matchesPattern('https://api.example.com/v1/users/123', '**/users/**', 'glob')).toBe(true)
  })

  it('does not match wrong path', () => {
    expect(matchesPattern('https://api.example.com/products', '*/users', 'glob')).toBe(false)
  })

  it('escapes dots in literal parts', () => {
    expect(matchesPattern('https://api.example.com/users', 'https://api.example.com/users', 'glob')).toBe(true)
    expect(matchesPattern('https://apiXexampleXcom/users', 'https://api.example.com/users', 'glob')).toBe(false)
  })
})

describe('matchesPattern - exact', () => {
  it('matches exact URL', () => {
    expect(matchesPattern('https://api.example.com/users', 'https://api.example.com/users', 'exact')).toBe(true)
  })

  it('does not match partial URL', () => {
    expect(matchesPattern('https://api.example.com/users/123', 'https://api.example.com/users', 'exact')).toBe(false)
  })
})

describe('matchesPattern - regex', () => {
  it('matches with regex pattern', () => {
    expect(matchesPattern('https://api.example.com/users/123', '/users/\\d+$', 'regex')).toBe(true)
  })

  it('does not match non-numeric user ID', () => {
    expect(matchesPattern('https://api.example.com/users/abc', '/users/\\d+$', 'regex')).toBe(false)
  })

  it('returns false for invalid regex', () => {
    expect(matchesPattern('anything', '[invalid(', 'regex')).toBe(false)
  })
})
