import { MockRule, HttpMethod } from '@/types'
import { matchesPattern } from '@/shared/url-pattern'
import { parseGraphQL } from '@/shared/graphql'

export interface IncomingRequest {
  url: string
  method: string
  body?: string
  requestHeaders?: Array<{ name: string; value: string }>
}

export function findMatchingRule(request: IncomingRequest, rules: MockRule[]): MockRule | null {
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (matchesRule(request, rule)) return rule
  }
  return null
}

function matchesRule(request: IncomingRequest, rule: MockRule): boolean {
  const { match } = rule

  if (!matchesPattern(request.url, match.urlPattern, match.urlPatternType)) return false

  if (match.methods.length > 0) {
    const method = request.method.toUpperCase() as HttpMethod
    if (!match.methods.includes(method)) return false
  }

  if (match.requestHeaders && match.requestHeaders.length > 0) {
    for (const headerMatcher of match.requestHeaders) {
      const found = request.requestHeaders?.find(
        (h) => h.name.toLowerCase() === headerMatcher.name.toLowerCase(),
      )
      if (!found) return false
      if (!matchesHeaderValue(found.value, headerMatcher.value, headerMatcher.matchType)) return false
    }
  }

  if (match.graphqlOperationName) {
    const gql = parseGraphQL(request.body)
    if (!gql || gql.operationName !== match.graphqlOperationName) return false
  }

  return true
}

function matchesHeaderValue(
  actual: string,
  expected: string,
  matchType: 'exact' | 'contains' | 'regex',
): boolean {
  switch (matchType) {
    case 'exact':
      return actual === expected
    case 'contains':
      return actual.includes(expected)
    case 'regex':
      try {
        return new RegExp(expected).test(actual)
      } catch {
        return false
      }
  }
}
