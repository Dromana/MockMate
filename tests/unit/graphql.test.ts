import { describe, it, expect } from 'vitest'
import { parseGraphQL } from '@/shared/graphql'

describe('parseGraphQL', () => {
  describe('returns null for invalid input', () => {
    it('returns null for null body', () => {
      expect(parseGraphQL(null)).toBeNull()
    })

    it('returns null for undefined body', () => {
      expect(parseGraphQL(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(parseGraphQL('')).toBeNull()
    })

    it('returns null for non-JSON body', () => {
      expect(parseGraphQL('not json at all')).toBeNull()
    })

    it('returns null when query field is missing', () => {
      expect(parseGraphQL(JSON.stringify({ operationName: 'Foo', variables: {} }))).toBeNull()
    })

    it('returns null when query field is not a string', () => {
      expect(parseGraphQL(JSON.stringify({ query: 123 }))).toBeNull()
    })
  })

  describe('operation type detection', () => {
    it('detects query operation type', () => {
      const body = JSON.stringify({ query: 'query GetUser { user { id } }' })
      expect(parseGraphQL(body)?.operationType).toBe('query')
    })

    it('detects mutation operation type', () => {
      const body = JSON.stringify({ query: 'mutation CreateUser($name: String!) { createUser(name: $name) { id } }' })
      expect(parseGraphQL(body)?.operationType).toBe('mutation')
    })

    it('detects subscription operation type', () => {
      const body = JSON.stringify({ query: 'subscription OnMessage { messageAdded { id text } }' })
      expect(parseGraphQL(body)?.operationType).toBe('subscription')
    })

    it('defaults to query when no operation keyword present', () => {
      const body = JSON.stringify({ query: '{ user { id } }' })
      expect(parseGraphQL(body)?.operationType).toBe('query')
    })
  })

  describe('operationName extraction', () => {
    it('extracts operationName from operationName field', () => {
      const body = JSON.stringify({
        query: 'query GetUser { user { id } }',
        operationName: 'GetUser',
      })
      expect(parseGraphQL(body)?.operationName).toBe('GetUser')
    })

    it('prefers operationName field over name in query string', () => {
      const body = JSON.stringify({
        query: 'query QueryName { user { id } }',
        operationName: 'ExplicitName',
      })
      expect(parseGraphQL(body)?.operationName).toBe('ExplicitName')
    })

    it('extracts operationName from query string when operationName field is absent', () => {
      const body = JSON.stringify({ query: 'query GetProfile { profile { email } }' })
      expect(parseGraphQL(body)?.operationName).toBe('GetProfile')
    })

    it('extracts operationName from mutation query string', () => {
      const body = JSON.stringify({ query: 'mutation DeleteUser($id: ID!) { deleteUser(id: $id) }' })
      expect(parseGraphQL(body)?.operationName).toBe('DeleteUser')
    })

    it('returns null operationName for anonymous operation', () => {
      const body = JSON.stringify({ query: 'query { user { id } }' })
      expect(parseGraphQL(body)?.operationName).toBeNull()
    })

    it('returns null operationName for shorthand query syntax', () => {
      const body = JSON.stringify({ query: '{ user { id } }' })
      expect(parseGraphQL(body)?.operationName).toBeNull()
    })
  })

  describe('whitespace handling', () => {
    it('handles leading whitespace before operation type', () => {
      const body = JSON.stringify({ query: '  \n  query GetUser { user { id } }' })
      expect(parseGraphQL(body)?.operationType).toBe('query')
    })

    it('handles leading whitespace in mutation', () => {
      const body = JSON.stringify({ query: '\n\nmutation CreateItem { createItem { id } }' })
      expect(parseGraphQL(body)?.operationType).toBe('mutation')
    })
  })
})
