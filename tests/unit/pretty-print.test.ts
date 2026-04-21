import { describe, it, expect } from 'vitest'
import { prettyPrint, detectFormat } from '@/shared/pretty-print'

describe('prettyPrint', () => {
  describe('json format', () => {
    it('formats compact JSON to indented output', () => {
      const input = '{"a":1,"b":{"c":2}}'
      const result = prettyPrint(input, 'json')
      expect(result).toBe(JSON.stringify({ a: 1, b: { c: 2 } }, null, 2))
    })

    it('returns original string on invalid JSON', () => {
      const input = 'not valid json {'
      expect(prettyPrint(input, 'json')).toBe(input)
    })

    it('formats a JSON array', () => {
      const input = '[1,2,3]'
      expect(prettyPrint(input, 'json')).toBe('[\n  1,\n  2,\n  3\n]')
    })
  })

  describe('graphql format', () => {
    it('extracts query string with real newlines', () => {
      const body = JSON.stringify({
        query: 'query GetUser {\n  user {\n    id\n  }\n}',
      })
      const result = prettyPrint(body, 'graphql')
      expect(result).toContain('query GetUser')
      expect(result).toContain('user {')
      expect(result).toContain('id')
    })

    it('shows operationName as a comment when present', () => {
      const body = JSON.stringify({
        query: 'query GetUser { user { id } }',
        operationName: 'GetUser',
      })
      const result = prettyPrint(body, 'graphql')
      expect(result).toContain('# Operation: GetUser')
    })

    it('does not show operationName comment when absent', () => {
      const body = JSON.stringify({
        query: 'query GetUser { user { id } }',
      })
      const result = prettyPrint(body, 'graphql')
      expect(result).not.toContain('# Operation:')
    })

    it('shows variables section when variables are present', () => {
      const body = JSON.stringify({
        query: 'query GetUser($id: ID!) { user(id: $id) { id } }',
        variables: { id: '42' },
      })
      const result = prettyPrint(body, 'graphql')
      expect(result).toContain('# Variables')
      expect(result).toContain('"id": "42"')
    })

    it('omits variables section when variables is null', () => {
      const body = JSON.stringify({
        query: 'query GetUser { user { id } }',
        variables: null,
      })
      const result = prettyPrint(body, 'graphql')
      expect(result).not.toContain('# Variables')
    })

    it('returns original body on invalid JSON', () => {
      const input = 'not json'
      expect(prettyPrint(input, 'graphql')).toBe(input)
    })
  })

  describe('unknown format', () => {
    it('returns body unchanged for unknown format', () => {
      const input = 'some random content'
      expect(prettyPrint(input, 'unknown')).toBe(input)
    })
  })
})

describe('detectFormat', () => {
  describe('content-type based detection', () => {
    it('returns json for application/json content-type', () => {
      expect(detectFormat('fetch', 'application/json')).toBe('json')
    })

    it('returns json for application/json;charset=utf-8 content-type', () => {
      expect(detectFormat('fetch', 'application/json;charset=utf-8')).toBe('json')
    })

    it('returns html for text/html content-type', () => {
      expect(detectFormat('document', 'text/html; charset=utf-8')).toBe('html')
    })

    it('returns js for application/javascript content-type', () => {
      expect(detectFormat('script', 'application/javascript')).toBe('js')
    })

    it('returns js for text/ecmascript content-type', () => {
      expect(detectFormat('script', 'text/ecmascript')).toBe('js')
    })

    it('returns css for text/css content-type', () => {
      expect(detectFormat('stylesheet', 'text/css')).toBe('css')
    })
  })

  describe('graphql resourceType', () => {
    it('returns json for graphql resourceType regardless of content-type', () => {
      expect(detectFormat('graphql', null)).toBe('json')
    })

    it('returns json for graphql resourceType with non-json content-type', () => {
      expect(detectFormat('graphql', 'text/plain')).toBe('json')
    })
  })

  describe('resourceType fallback', () => {
    it('returns json for fetch resourceType when no content-type', () => {
      expect(detectFormat('fetch', null)).toBe('json')
    })

    it('returns json for fetch resourceType with undefined content-type', () => {
      expect(detectFormat('fetch', undefined)).toBe('json')
    })

    it('returns html for document resourceType when no content-type', () => {
      expect(detectFormat('document', null)).toBe('html')
    })

    it('returns js for script resourceType when no content-type', () => {
      expect(detectFormat('script', null)).toBe('js')
    })

    it('returns css for stylesheet resourceType when no content-type', () => {
      expect(detectFormat('stylesheet', null)).toBe('css')
    })

    it('returns unknown for unrecognised resourceType and no content-type', () => {
      expect(detectFormat('image', null)).toBe('unknown')
    })
  })

  describe('content-type takes priority over resourceType', () => {
    it('json content-type wins over document resourceType', () => {
      expect(detectFormat('document', 'application/json')).toBe('json')
    })
  })
})
