import { create } from 'zustand'
import { RequestLogEntry, HeaderModification, QueryParamModification } from '@/types'

const MAX_ENTRIES = 1000

export type LogFilter = 'All' | 'GraphQL' | 'Fetch/XHR' | 'JS' | 'CSS' | 'Img' | 'Doc' | 'Other'

// Queued mock notifications that arrived before the matching onRequestFinished entry.
// Keyed by "METHOD:URL".
interface PendingMock {
  ruleId: string
  ruleName: string
  statusCode: number
  mockResponseBody: string | null
  mockResponseHeaders: Record<string, string>
}
const pendingMocks = new Map<string, PendingMock>()

interface PendingPayloadMock {
  ruleId: string
  ruleName: string
  mockRequestBody: string | null
  mockRequestAdditionalHeaders: Record<string, string>
}
const pendingPayloadMocks = new Map<string, PendingPayloadMock>()

interface PendingPayloadResponse {
  statusCode: number
  responseBody: string | null
  responseHeaders: Record<string, string>
}
const pendingPayloadResponses = new Map<string, PendingPayloadResponse>()

interface PendingHeadersMod {
  ruleId: string
  ruleName: string
  requestHeaderMods: HeaderModification[]
  responseHeaderMods: HeaderModification[]
}
const pendingHeadersMods = new Map<string, PendingHeadersMod>()

interface PendingQueryParamsMod {
  ruleId: string
  ruleName: string
  queryParamMods: QueryParamModification[]
}
const pendingQueryParamsMods = new Map<string, PendingQueryParamsMod>()

interface PendingRedirect {
  ruleId: string
  ruleName: string
  redirectedTo: string
}
const pendingRedirects = new Map<string, PendingRedirect>()

function decodeBase64Body(b64: string | null): string | null {
  if (!b64) return null
  try {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return b64
  }
}


interface LogStore {
  entries: RequestLogEntry[]
  preserveLog: boolean
  filter: LogFilter
  selectedEntryId: string | null
  appendEntry: (entry: RequestLogEntry) => void
  updateResponseBody: (id: string, body: string) => void
  markAsMocked: (
    url: string,
    method: string,
    graphqlOperationName: string | null,
    ruleId: string,
    ruleName: string,
    statusCode: number,
    mockResponseBody: string | null,
    mockResponseHeaders: Record<string, string>,
  ) => void
  markAsPayloadMocked: (
    url: string,
    method: string,
    graphqlOperationName: string | null,
    ruleId: string,
    ruleName: string,
    mockRequestBody: string | null,
    mockRequestAdditionalHeaders: Record<string, string>,
  ) => void
  applyPayloadResponse: (
    url: string,
    method: string,
    graphqlOperationName: string | null,
    statusCode: number,
    responseBody: string | null,
    responseHeaders: Record<string, string>,
  ) => void
  markAsHeadersModified: (
    url: string,
    method: string,
    graphqlOperationName: string | null,
    ruleId: string,
    ruleName: string,
    requestHeaderMods: HeaderModification[],
    responseHeaderMods: HeaderModification[],
  ) => void
  markAsQueryParamsModified: (
    url: string,
    method: string,
    graphqlOperationName: string | null,
    ruleId: string,
    ruleName: string,
    queryParamMods: QueryParamModification[],
  ) => void
  markAsRedirected: (
    url: string,
    method: string,
    graphqlOperationName: string | null,
    ruleId: string,
    ruleName: string,
    redirectedTo: string,
  ) => void
  onNavigation: () => void
  clearLog: () => void
  setPreserveLog: (val: boolean) => void
  setFilter: (filter: LogFilter) => void
  selectEntry: (id: string | null) => void
}

export const useLogStore = create<LogStore>((set, get) => ({
  entries: [],
  preserveLog: false,
  filter: 'All',
  selectedEntryId: null,

  appendEntry: (entry) => {
    // If a mock notification arrived before this entry, apply it immediately.
    // GraphQL entries use operation name in the key so different operations don't collide.
    const key = entry.graphqlOperationName
      ? `${entry.method}:${entry.url}:${entry.graphqlOperationName}`
      : `${entry.method}:${entry.url}`
    const mock = pendingMocks.get(key)
    if (mock) {
      pendingMocks.delete(key)
      entry = {
        ...entry,
        status: 'mocked',
        matchedRuleId: mock.ruleId,
        matchedRuleName: mock.ruleName,
        statusCode: mock.statusCode,
        mockResponseBody: mock.mockResponseBody,
        mockResponseHeaders: mock.mockResponseHeaders,
      }
    }
    const headersMod = pendingHeadersMods.get(key)
    if (headersMod) {
      pendingHeadersMods.delete(key)
      entry = {
        ...entry,
        status: 'headers-modified',
        matchedRuleId: headersMod.ruleId,
        matchedRuleName: headersMod.ruleName,
        appliedHeaderMods: {
          requestHeaders: headersMod.requestHeaderMods,
          responseHeaders: headersMod.responseHeaderMods,
        },
      }
    }
    const queryParamsMod = pendingQueryParamsMods.get(key)
    if (queryParamsMod) {
      pendingQueryParamsMods.delete(key)
      entry = {
        ...entry,
        status: 'query-params-modified',
        matchedRuleId: queryParamsMod.ruleId,
        matchedRuleName: queryParamsMod.ruleName,
        appliedQueryParamMods: queryParamsMod.queryParamMods,
      }
    }
    const redirect = pendingRedirects.get(key)
    if (redirect) {
      pendingRedirects.delete(key)
      entry = {
        ...entry,
        status: 'redirected',
        matchedRuleId: redirect.ruleId,
        matchedRuleName: redirect.ruleName,
        redirectedTo: redirect.redirectedTo,
      }
    }
    const payloadMock = pendingPayloadMocks.get(key)
    if (payloadMock) {
      pendingPayloadMocks.delete(key)
      entry = {
        ...entry,
        status: 'payload-mocked',
        matchedRuleId: payloadMock.ruleId,
        matchedRuleName: payloadMock.ruleName,
        mockRequestBody: payloadMock.mockRequestBody,
        mockRequestAdditionalHeaders: payloadMock.mockRequestAdditionalHeaders,
      }
      // Apply proxy response data if it arrived before the HAR entry
      const proxyResp = pendingPayloadResponses.get(key)
      if (proxyResp) {
        pendingPayloadResponses.delete(key)
        entry = {
          ...entry,
          statusCode: proxyResp.statusCode,
          responseBody: proxyResp.responseBody,
          responseHeaders: proxyResp.responseHeaders,
        }
      }
    }
    set((state) => {
      const entries = [...state.entries, entry]
      return { entries: entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries }
    })
  },

  updateResponseBody: (id, body) => {
    set((state) => ({
      entries: state.entries.map((e) => (e.id === id ? { ...e, responseBody: body } : e)),
    }))
  },

  markAsMocked: (url, method, graphqlOperationName, ruleId, ruleName, statusCode, mockResponseBody, mockResponseHeaders) => {
    const state = get()
    // For GraphQL, match on operation name (all GQL requests share the same url+method)
    const matchEntry = (e: RequestLogEntry) => {
      if (e.url !== url || e.method !== method || e.status === 'mocked') return false
      if (graphqlOperationName) return e.graphqlOperationName === graphqlOperationName
      return true
    }

    let foundId: string | null = null
    for (let i = state.entries.length - 1; i >= 0; i--) {
      if (matchEntry(state.entries[i])) { foundId = state.entries[i].id; break }
    }

    const mockData = { ruleId, ruleName, statusCode, mockResponseBody, mockResponseHeaders }

    if (foundId) {
      set((s) => ({
        entries: s.entries.map((e) =>
          e.id === foundId
            ? { ...e, status: 'mocked' as const, matchedRuleId: ruleId, matchedRuleName: ruleName, statusCode, mockResponseBody, mockResponseHeaders }
            : e,
        ),
      }))
    } else {
      // Entry hasn't arrived from onRequestFinished yet — queue for appendEntry
      const key = graphqlOperationName ? `${method}:${url}:${graphqlOperationName}` : `${method}:${url}`
      pendingMocks.set(key, mockData)
    }
  },

  markAsPayloadMocked: (url, method, graphqlOperationName, ruleId, ruleName, mockRequestBody, mockRequestAdditionalHeaders) => {
    const state = get()
    const matchEntry = (e: RequestLogEntry) => {
      if (e.url !== url || e.method !== method || e.status === 'payload-mocked') return false
      if (graphqlOperationName) return e.graphqlOperationName === graphqlOperationName
      return true
    }

    let foundId: string | null = null
    for (let i = state.entries.length - 1; i >= 0; i--) {
      if (matchEntry(state.entries[i])) { foundId = state.entries[i].id; break }
    }

    const payloadMockData = { ruleId, ruleName, mockRequestBody, mockRequestAdditionalHeaders }

    if (foundId) {
      set((s) => ({
        entries: s.entries.map((e) =>
          e.id === foundId
            ? { ...e, status: 'payload-mocked' as const, matchedRuleId: ruleId, matchedRuleName: ruleName, mockRequestBody, mockRequestAdditionalHeaders }
            : e,
        ),
      }))
    } else {
      const key = graphqlOperationName ? `${method}:${url}:${graphqlOperationName}` : `${method}:${url}`
      pendingPayloadMocks.set(key, payloadMockData)
    }
  },

  applyPayloadResponse: (url, method, graphqlOperationName, statusCode, responseBodyB64, responseHeaders) => {
    const responseBody = decodeBase64Body(responseBodyB64)
    const state = get()
    const matchEntry = (e: RequestLogEntry) => {
      if (e.url !== url || e.method !== method || e.status !== 'payload-mocked') return false
      if (graphqlOperationName) return e.graphqlOperationName === graphqlOperationName
      return true
    }

    let foundId: string | null = null
    for (let i = state.entries.length - 1; i >= 0; i--) {
      if (matchEntry(state.entries[i])) { foundId = state.entries[i].id; break }
    }

    if (foundId) {
      set((s) => ({
        entries: s.entries.map((e) =>
          e.id === foundId
            ? { ...e, statusCode, responseBody, responseHeaders }
            : e,
        ),
      }))
    } else {
      // Entry hasn't arrived from onRequestFinished yet — queue for appendEntry
      const key = graphqlOperationName ? `${method}:${url}:${graphqlOperationName}` : `${method}:${url}`
      pendingPayloadResponses.set(key, { statusCode, responseBody, responseHeaders })
    }
  },

  markAsHeadersModified: (url, method, graphqlOperationName, ruleId, ruleName, requestHeaderMods, responseHeaderMods) => {
    const state = get()
    const matchEntry = (e: RequestLogEntry) => {
      if (e.url !== url || e.method !== method || e.status === 'headers-modified') return false
      if (graphqlOperationName) return e.graphqlOperationName === graphqlOperationName
      return true
    }

    let foundId: string | null = null
    for (let i = state.entries.length - 1; i >= 0; i--) {
      if (matchEntry(state.entries[i])) { foundId = state.entries[i].id; break }
    }

    const appliedHeaderMods = { requestHeaders: requestHeaderMods, responseHeaders: responseHeaderMods }

    if (foundId) {
      set((s) => ({
        entries: s.entries.map((e) =>
          e.id === foundId
            ? { ...e, status: 'headers-modified' as const, matchedRuleId: ruleId, matchedRuleName: ruleName, appliedHeaderMods }
            : e,
        ),
      }))
    } else {
      const key = graphqlOperationName ? `${method}:${url}:${graphqlOperationName}` : `${method}:${url}`
      pendingHeadersMods.set(key, { ruleId, ruleName, requestHeaderMods, responseHeaderMods })
    }
  },

  markAsQueryParamsModified: (url, method, graphqlOperationName, ruleId, ruleName, queryParamMods) => {
    const state = get()
    const matchEntry = (e: RequestLogEntry) => {
      if (e.url !== url || e.method !== method || e.status === 'query-params-modified') return false
      if (graphqlOperationName) return e.graphqlOperationName === graphqlOperationName
      return true
    }

    let foundId: string | null = null
    for (let i = state.entries.length - 1; i >= 0; i--) {
      if (matchEntry(state.entries[i])) { foundId = state.entries[i].id; break }
    }

    if (foundId) {
      set((s) => ({
        entries: s.entries.map((e) =>
          e.id === foundId
            ? { ...e, status: 'query-params-modified' as const, matchedRuleId: ruleId, matchedRuleName: ruleName, appliedQueryParamMods: queryParamMods }
            : e,
        ),
      }))
    } else {
      const key = graphqlOperationName ? `${method}:${url}:${graphqlOperationName}` : `${method}:${url}`
      pendingQueryParamsMods.set(key, { ruleId, ruleName, queryParamMods })
    }
  },

  markAsRedirected: (url, method, graphqlOperationName, ruleId, ruleName, redirectedTo) => {
    const state = get()
    const matchEntry = (e: RequestLogEntry) => {
      if (e.url !== url || e.method !== method || e.status === 'redirected') return false
      if (graphqlOperationName) return e.graphqlOperationName === graphqlOperationName
      return true
    }

    let foundId: string | null = null
    for (let i = state.entries.length - 1; i >= 0; i--) {
      if (matchEntry(state.entries[i])) { foundId = state.entries[i].id; break }
    }

    if (foundId) {
      set((s) => ({
        entries: s.entries.map((e) =>
          e.id === foundId
            ? { ...e, status: 'redirected' as const, matchedRuleId: ruleId, matchedRuleName: ruleName, redirectedTo }
            : e,
        ),
      }))
    } else {
      const key = graphqlOperationName ? `${method}:${url}:${graphqlOperationName}` : `${method}:${url}`
      pendingRedirects.set(key, { ruleId, ruleName, redirectedTo })
    }
  },

  // onNavigated fires before any requests for the new page, so immediate clear is safe
  onNavigation: () => {
    if (!get().preserveLog) {
      set({ entries: [], selectedEntryId: null })
    }
  },

  clearLog: () => set({ entries: [], selectedEntryId: null }),
  setPreserveLog: (preserveLog) => set({ preserveLog }),
  setFilter: (filter) => set({ filter }),
  selectEntry: (selectedEntryId) => set({ selectedEntryId }),
}))

export function filterEntries(entries: RequestLogEntry[], filter: LogFilter): RequestLogEntry[] {
  if (filter === 'All') return entries

  return entries.filter((e) => {
    const url = e.url.toLowerCase()
    switch (filter) {
      case 'GraphQL':
        return e.resourceType === 'graphql'
      case 'Fetch/XHR':
        return !url.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|ico|html?)(\?|$)/) && e.resourceType !== 'graphql'
      case 'JS':
        return url.match(/\.m?js(\?|$)/) !== null
      case 'CSS':
        return url.match(/\.css(\?|$)/) !== null
      case 'Img':
        return url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)(\?|$)/) !== null
      case 'Doc':
        return url.match(/\.html?(\?|$)/) !== null || e.requestHeaders['accept']?.includes('text/html')
      case 'Other':
        return url.match(/\.(woff2?|ttf|eot)(\?|$)/) !== null
      default:
        return true
    }
  })
}
