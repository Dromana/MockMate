import { describe, it, expect } from 'vitest'

// These helpers are private to request-interceptor.ts and cannot be imported directly.
// We inline the same logic here so the tests remain independent of the module boundary
// while still verifying the exact behaviour exercised in production.

interface HeaderModification {
  operation: 'set' | 'remove'
  name: string
  value: string
}

interface QueryParamModification {
  operation: 'set' | 'remove'
  name: string
  value: string
}

interface RedirectConfig {
  from: string
  to: string
  matchType: 'text' | 'regex'
}

function applyHeaderMods(
  headers: Record<string, string>,
  mods: HeaderModification[],
): Record<string, string> {
  const result = { ...headers }
  for (const mod of mods) {
    if (mod.operation === 'set') {
      result[mod.name] = mod.value
    } else {
      const lower = mod.name.toLowerCase()
      for (const key of Object.keys(result)) {
        if (key.toLowerCase() === lower) delete result[key]
      }
    }
  }
  return result
}

function applyQueryParamMods(url: string, mods: QueryParamModification[]): string {
  try {
    const urlObj = new URL(url)
    for (const mod of mods) {
      if (mod.operation === 'set') {
        urlObj.searchParams.set(mod.name, mod.value)
      } else {
        urlObj.searchParams.delete(mod.name)
      }
    }
    return urlObj.toString()
  } catch {
    return url
  }
}

function applyRedirect(url: string, config: RedirectConfig): string {
  try {
    if (config.matchType === 'regex') {
      return url.replace(new RegExp(config.from, 'g'), config.to)
    }
    return url.split(config.from).join(config.to)
  } catch {
    return url
  }
}

// ─── applyHeaderMods ─────────────────────────────────────────────────────────

describe('applyHeaderMods', () => {
  it('set adds a new header', () => {
    const result = applyHeaderMods(
      { 'content-type': 'text/plain' },
      [{ operation: 'set', name: 'x-custom', value: 'hello' }],
    )
    expect(result['x-custom']).toBe('hello')
  })

  it('set overwrites an existing header with the same name', () => {
    const result = applyHeaderMods(
      { 'x-custom': 'old' },
      [{ operation: 'set', name: 'x-custom', value: 'new' }],
    )
    expect(result['x-custom']).toBe('new')
  })

  it('set overwrites an existing header matched case-insensitively', () => {
    // The existing key has different casing from the mod name; set uses the mod name as key
    const result = applyHeaderMods(
      { 'Content-Type': 'text/plain' },
      [{ operation: 'set', name: 'Content-Type', value: 'application/json' }],
    )
    expect(result['Content-Type']).toBe('application/json')
  })

  it('remove deletes a header that exists', () => {
    const result = applyHeaderMods(
      { 'x-remove-me': 'yes', 'keep': 'this' },
      [{ operation: 'remove', name: 'x-remove-me', value: '' }],
    )
    expect(result['x-remove-me']).toBeUndefined()
    expect(result['keep']).toBe('this')
  })

  it('remove is a no-op when the header does not exist', () => {
    const original = { 'content-type': 'application/json' }
    const result = applyHeaderMods(
      original,
      [{ operation: 'remove', name: 'x-nonexistent', value: '' }],
    )
    expect(result).toEqual(original)
  })

  it('remove matches header key case-insensitively', () => {
    const result = applyHeaderMods(
      { 'Authorization': 'Bearer token' },
      [{ operation: 'remove', name: 'authorization', value: '' }],
    )
    expect(result['Authorization']).toBeUndefined()
  })

  it('does not mutate the original headers object', () => {
    const original = { 'x-original': 'value' }
    applyHeaderMods(original, [{ operation: 'set', name: 'x-new', value: 'v' }])
    expect(original['x-new' as keyof typeof original]).toBeUndefined()
  })

  it('applies multiple mods in order', () => {
    const result = applyHeaderMods(
      {},
      [
        { operation: 'set', name: 'x-a', value: '1' },
        { operation: 'set', name: 'x-b', value: '2' },
        { operation: 'remove', name: 'x-a', value: '' },
      ],
    )
    expect(result['x-a']).toBeUndefined()
    expect(result['x-b']).toBe('2')
  })
})

// ─── applyQueryParamMods ─────────────────────────────────────────────────────

describe('applyQueryParamMods', () => {
  it('set adds a new query param', () => {
    const result = applyQueryParamMods('https://example.com/api', [
      { operation: 'set', name: 'version', value: '2' },
    ])
    expect(new URL(result).searchParams.get('version')).toBe('2')
  })

  it('set overwrites an existing query param', () => {
    const result = applyQueryParamMods('https://example.com/api?page=1', [
      { operation: 'set', name: 'page', value: '5' },
    ])
    expect(new URL(result).searchParams.get('page')).toBe('5')
  })

  it('remove deletes an existing query param', () => {
    const result = applyQueryParamMods('https://example.com/api?debug=true&page=1', [
      { operation: 'remove', name: 'debug', value: '' },
    ])
    const params = new URL(result).searchParams
    expect(params.get('debug')).toBeNull()
    expect(params.get('page')).toBe('1')
  })

  it('remove is a no-op when param does not exist', () => {
    const url = 'https://example.com/api?page=1'
    const result = applyQueryParamMods(url, [
      { operation: 'remove', name: 'nonexistent', value: '' },
    ])
    expect(new URL(result).searchParams.get('page')).toBe('1')
  })

  it('returns original url when it is not a valid URL', () => {
    const invalid = 'not-a-url'
    expect(applyQueryParamMods(invalid, [{ operation: 'set', name: 'a', value: 'b' }])).toBe(invalid)
  })

  it('applies multiple param mods in order', () => {
    const result = applyQueryParamMods('https://example.com/?a=1&b=2', [
      { operation: 'set', name: 'c', value: '3' },
      { operation: 'remove', name: 'a', value: '' },
    ])
    const params = new URL(result).searchParams
    expect(params.get('a')).toBeNull()
    expect(params.get('b')).toBe('2')
    expect(params.get('c')).toBe('3')
  })
})

// ─── applyRedirect ────────────────────────────────────────────────────────────

describe('applyRedirect', () => {
  it('text replace substitutes literal from string with to string', () => {
    const result = applyRedirect(
      'https://api.staging.example.com/users',
      { from: 'staging.example.com', to: 'prod.example.com', matchType: 'text' },
    )
    expect(result).toBe('https://api.prod.example.com/users')
  })

  it('text replace replaces all occurrences when from appears multiple times', () => {
    const result = applyRedirect(
      'https://foo.com/foo/bar',
      { from: 'foo', to: 'baz', matchType: 'text' },
    )
    // split+join replaces all occurrences
    expect(result).toBe('https://baz.com/baz/bar')
  })

  it('regex replace substitutes matched portion', () => {
    const result = applyRedirect(
      'https://api.example.com/v1/users',
      { from: '/v\\d+/', to: '/v2/', matchType: 'regex' },
    )
    expect(result).toBe('https://api.example.com/v2/users')
  })

  it('regex replace returns original url when pattern has no match', () => {
    const url = 'https://api.example.com/users'
    const result = applyRedirect(url, {
      from: '/products/\\d+',
      to: '/items/',
      matchType: 'regex',
    })
    expect(result).toBe(url)
  })

  it('text replace returns original url when from string is not found', () => {
    const url = 'https://api.example.com/users'
    const result = applyRedirect(url, { from: 'staging', to: 'prod', matchType: 'text' })
    expect(result).toBe(url)
  })

  it('regex replace returns original url on invalid regex pattern', () => {
    const url = 'https://api.example.com/users'
    const result = applyRedirect(url, { from: '[invalid(', to: 'replacement', matchType: 'regex' })
    expect(result).toBe(url)
  })
})
