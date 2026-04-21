export type GraphQLOperationType = 'query' | 'mutation' | 'subscription'

export interface GraphQLInfo {
  operationName: string | null
  operationType: GraphQLOperationType
}

/**
 * Returns GraphQL metadata if the body is a valid GraphQL request, null otherwise.
 */
export function parseGraphQL(body: string | undefined | null): GraphQLInfo | null {
  if (!body) return null
  try {
    const parsed = JSON.parse(body)
    if (typeof parsed.query !== 'string') return null

    const typeMatch = parsed.query.trim().match(/^(query|mutation|subscription)[\s({]/)
    const operationType = (typeMatch?.[1] ?? 'query') as GraphQLOperationType

    let operationName: string | null = parsed.operationName ?? null
    if (!operationName) {
      const nameMatch = parsed.query.trim().match(/^(?:query|mutation|subscription)\s+(\w+)/)
      operationName = nameMatch?.[1] ?? null
    }

    return { operationName, operationType }
  } catch {
    return null
  }
}
