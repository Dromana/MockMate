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
    if (rule.action === 'inject_script') continue  // page-level only, not request-level
    if (matchesRule(request, rule)) return rule
  }
  return null
}

/** Returns null if the rule matches, or a string describing the first failing condition. */
export function getRuleMatchFailReason(request: IncomingRequest, rule: MockRule): string | null {
  const { match } = rule

  if (!matchesPattern(request.url, match.urlPattern, match.urlPatternType)) {
    return `url pattern "${match.urlPattern}" (${match.urlPatternType}) did not match "${request.url}"`
  }

  if (match.methods.length > 0) {
    const method = request.method.toUpperCase() as HttpMethod
    if (!match.methods.includes(method)) {
      return `method "${request.method}" not in rule methods [${match.methods.join(', ')}]`
    }
  }

  if (match.requestHeaders && match.requestHeaders.length > 0) {
    for (const headerMatcher of match.requestHeaders) {
      const found = request.requestHeaders?.find(
        (h) => h.name.toLowerCase() === headerMatcher.name.toLowerCase(),
      )
      if (!found) return `required header "${headerMatcher.name}" not present in request`
      if (!matchesHeaderValue(found.value, headerMatcher.value, headerMatcher.matchType)) {
        return `header "${headerMatcher.name}" value "${found.value}" did not match expected "${headerMatcher.value}" (${headerMatcher.matchType})`
      }
    }
  }

  if (match.graphqlOperationName) {
    const gql = parseGraphQL(request.body)
    if (!gql) return `graphql operation name filter set to "${match.graphqlOperationName}" but request body is not valid GraphQL JSON (body: ${request.body ? request.body.slice(0, 120) : '<empty>'})`
    if (gql.operationName !== match.graphqlOperationName) {
      return `graphql operation name "${gql.operationName}" did not match rule filter "${match.graphqlOperationName}"`
    }
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
