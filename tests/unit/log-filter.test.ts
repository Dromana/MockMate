import { describe, it, expect } from 'vitest'
import { filterEntries } from '@/panel/store/log-store'
import { RequestLogEntry } from '@/types'

function makeEntry(overrides: Partial<RequestLogEntry>): RequestLogEntry {
  return {
    id: Math.random().toString(36).slice(2),
    tabId: 1,
    url: 'https://example.com/api/data',
    method: 'GET',
    statusCode: 200,
    resourceType: 'fetch',
    requestHeaders: {},
    requestBody: null,
    responseHeaders: {},
    responseBody: null,
    status: 'passthrough',
    timestamp: Date.now(),
    duration: 100,
    transferSize: null,
    fromCache: false,
    graphqlOperationName: null,
    graphqlOperationType: null,
    matchedRuleId: null,
    matchedRuleName: null,
    mockResponseBody: null,
    mockResponseHeaders: null,
    mockRequestBody: null,
    mockRequestAdditionalHeaders: null,
    appliedHeaderMods: null,
    appliedQueryParamMods: null,
    redirectedTo: null,
    ...overrides,
  }
}

describe('filterEntries', () => {
  describe('All filter', () => {
    it('returns all entries unchanged', () => {
      const entries = [
        makeEntry({ url: 'https://example.com/api/data', resourceType: 'fetch' }),
        makeEntry({ url: 'https://example.com/style.css', resourceType: 'stylesheet' }),
        makeEntry({ url: 'https://example.com/app.js', resourceType: 'script' }),
        makeEntry({ url: 'https://example.com/graphql', resourceType: 'graphql' }),
      ]
      expect(filterEntries(entries, 'All')).toHaveLength(4)
    })

    it('returns empty array when no entries', () => {
      expect(filterEntries([], 'All')).toHaveLength(0)
    })
  })

  describe('GraphQL filter', () => {
    it('returns only entries with graphql resourceType', () => {
      const gqlEntry = makeEntry({ url: 'https://example.com/graphql', resourceType: 'graphql' })
      const fetchEntry = makeEntry({ url: 'https://example.com/api/data', resourceType: 'fetch' })
      const result = filterEntries([gqlEntry, fetchEntry], 'GraphQL')
      expect(result).toHaveLength(1)
      expect(result[0]).toBe(gqlEntry)
    })

    it('returns empty when no graphql entries', () => {
      const entries = [
        makeEntry({ url: 'https://example.com/api/data', resourceType: 'fetch' }),
      ]
      expect(filterEntries(entries, 'GraphQL')).toHaveLength(0)
    })
  })

  describe('Fetch/XHR filter', () => {
    it('includes plain fetch API requests', () => {
      const entry = makeEntry({ url: 'https://example.com/api/users', resourceType: 'fetch' })
      const result = filterEntries([entry], 'Fetch/XHR')
      expect(result).toContain(entry)
    })

    it('excludes .js URLs', () => {
      const entry = makeEntry({ url: 'https://example.com/bundle.js', resourceType: 'script' })
      expect(filterEntries([entry], 'Fetch/XHR')).toHaveLength(0)
    })

    it('excludes .css URLs', () => {
      const entry = makeEntry({ url: 'https://example.com/style.css', resourceType: 'stylesheet' })
      expect(filterEntries([entry], 'Fetch/XHR')).toHaveLength(0)
    })

    it('excludes image URLs (.png)', () => {
      const entry = makeEntry({ url: 'https://example.com/logo.png', resourceType: 'image' })
      expect(filterEntries([entry], 'Fetch/XHR')).toHaveLength(0)
    })

    it('excludes .html URLs', () => {
      const entry = makeEntry({ url: 'https://example.com/page.html', resourceType: 'document' })
      expect(filterEntries([entry], 'Fetch/XHR')).toHaveLength(0)
    })

    it('excludes graphql resourceType', () => {
      const entry = makeEntry({ url: 'https://example.com/graphql', resourceType: 'graphql' })
      expect(filterEntries([entry], 'Fetch/XHR')).toHaveLength(0)
    })

    it('includes JSON API endpoints that have query strings', () => {
      const entry = makeEntry({ url: 'https://example.com/api/data?page=1', resourceType: 'fetch' })
      const result = filterEntries([entry], 'Fetch/XHR')
      expect(result).toContain(entry)
    })
  })

  describe('JS filter', () => {
    it('includes .js URLs', () => {
      const entry = makeEntry({ url: 'https://example.com/bundle.js', resourceType: 'script' })
      expect(filterEntries([entry], 'JS')).toContain(entry)
    })

    it('includes .mjs URLs', () => {
      const entry = makeEntry({ url: 'https://example.com/module.mjs', resourceType: 'script' })
      expect(filterEntries([entry], 'JS')).toContain(entry)
    })

    it('includes .js URLs with a query string', () => {
      const entry = makeEntry({ url: 'https://example.com/app.js?v=123', resourceType: 'script' })
      expect(filterEntries([entry], 'JS')).toContain(entry)
    })

    it('excludes .css URLs', () => {
      const entry = makeEntry({ url: 'https://example.com/style.css', resourceType: 'stylesheet' })
      expect(filterEntries([entry], 'JS')).toHaveLength(0)
    })

    it('excludes plain API fetch URLs', () => {
      const entry = makeEntry({ url: 'https://example.com/api/data', resourceType: 'fetch' })
      expect(filterEntries([entry], 'JS')).toHaveLength(0)
    })
  })

  describe('CSS filter', () => {
    it('includes .css URLs', () => {
      const entry = makeEntry({ url: 'https://example.com/styles/main.css', resourceType: 'stylesheet' })
      expect(filterEntries([entry], 'CSS')).toContain(entry)
    })

    it('includes .css URLs with a query string', () => {
      const entry = makeEntry({ url: 'https://example.com/main.css?v=42', resourceType: 'stylesheet' })
      expect(filterEntries([entry], 'CSS')).toContain(entry)
    })

    it('excludes .js URLs', () => {
      const entry = makeEntry({ url: 'https://example.com/bundle.js', resourceType: 'script' })
      expect(filterEntries([entry], 'CSS')).toHaveLength(0)
    })

    it('excludes plain fetch API URLs', () => {
      const entry = makeEntry({ url: 'https://example.com/api/data', resourceType: 'fetch' })
      expect(filterEntries([entry], 'CSS')).toHaveLength(0)
    })
  })
})
