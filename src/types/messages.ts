import { MockRule, HeaderModification, QueryParamModification } from './rule'

export type MessageType =
  | 'ATTACH_DEBUGGER'
  | 'DETACH_DEBUGGER'
  | 'UPDATE_RULES'
  | 'GET_STATUS'
  | 'DEBUGGER_ATTACHED'
  | 'DEBUGGER_DETACHED'
  | 'REQUEST_MATCHED'
  | 'REQUEST_PAYLOAD_MOCKED'

export interface AttachDebuggerMessage {
  type: 'ATTACH_DEBUGGER'
  tabId: number
}

export interface DetachDebuggerMessage {
  type: 'DETACH_DEBUGGER'
  tabId: number
}

export interface UpdateRulesMessage {
  type: 'UPDATE_RULES'
  rules: MockRule[]
  isGloballyEnabled: boolean
}

export interface GetStatusMessage {
  type: 'GET_STATUS'
  tabId: number
}

export interface StatusResponse {
  attached: boolean
  tabId: number
}

export type ExtensionMessage =
  | AttachDebuggerMessage
  | DetachDebuggerMessage
  | UpdateRulesMessage
  | GetStatusMessage

// ── Network Log Types ──────────────────────────────────────────────────────

export type LogEntryStatus = 'mocked' | 'payload-mocked' | 'headers-modified' | 'query-params-modified' | 'redirected' | 'passthrough'

export interface RequestLogEntry {
  id: string
  tabId: number
  method: string
  url: string
  requestHeaders: Record<string, string>
  requestBody: string | null
  timestamp: number
  fromCache: boolean

  status: LogEntryStatus
  statusCode: number | null

  // Populated for mock_response entries
  matchedRuleId: string | null
  matchedRuleName: string | null
  mockResponseBody: string | null
  mockResponseHeaders: Record<string, string> | null

  // Populated for mock_request (payload-mocked) entries
  mockRequestBody: string | null
  mockRequestAdditionalHeaders: Record<string, string> | null

  // Populated for headers-modified entries — the modifications that were applied
  appliedHeaderMods: { requestHeaders: HeaderModification[], responseHeaders: HeaderModification[] } | null

  // Populated for query-params-modified entries
  appliedQueryParamMods: QueryParamModification[] | null

  // Populated for redirected entries
  redirectedTo: string | null

  // Response headers (from onRequestFinished HAR entry)
  responseHeaders: Record<string, string> | null
  // Actual response body text (fetched via HAR getContent(); null until loaded or binary)
  responseBody: string | null

  // Metrics populated from HAR entry
  resourceType: string        // document | script | stylesheet | image | font | fetch | graphql | other
  transferSize: number | null // bytes actually transferred (0 = from cache)
  duration: number | null     // total request time in ms

  // GraphQL — populated when the POST body is a valid GraphQL request
  graphqlOperationName: string | null
  graphqlOperationType: 'query' | 'mutation' | 'subscription' | null
}

// Sent by the service worker when a mock rule fires for a request
export interface RequestMockedMessage {
  type: 'REQUEST_MOCKED'
  url: string
  method: string
  graphqlOperationName: string | null
  ruleId: string
  ruleName: string
  statusCode: number
  mockResponseBody: string | null
  mockResponseHeaders: Record<string, string>
}

// Sent by the service worker when a request payload mock rule fires
export interface RequestPayloadMockedMessage {
  type: 'REQUEST_PAYLOAD_MOCKED'
  url: string
  method: string
  graphqlOperationName: string | null
  ruleId: string
  ruleName: string
  mockRequestBody: string | null
  additionalHeaders: Record<string, string>
}

// Sent after the proxy fetch completes — carries the real server response so the
// panel can populate the Response tab for payload-mocked entries.
export interface RequestProxyResponseMessage {
  type: 'REQUEST_PROXY_RESPONSE'
  url: string
  method: string
  graphqlOperationName: string | null
  statusCode: number
  responseBody: string | null  // base64-encoded
  responseHeaders: Record<string, string>
}

// Sent by the service worker when a modify_headers rule fires for a request
export interface RequestHeadersModifiedMessage {
  type: 'REQUEST_HEADERS_MODIFIED'
  url: string
  method: string
  graphqlOperationName: string | null
  ruleId: string
  ruleName: string
  requestHeaderMods: HeaderModification[]
  responseHeaderMods: HeaderModification[]
}

// Sent by the service worker when a modify_query_params rule fires for a request
export interface RequestQueryParamsModifiedMessage {
  type: 'REQUEST_QUERY_PARAMS_MODIFIED'
  url: string
  method: string
  graphqlOperationName: string | null
  ruleId: string
  ruleName: string
  queryParamMods: QueryParamModification[]
}

// Sent by the service worker when a redirect rule fires for a request
export interface RequestRedirectedMessage {
  type: 'REQUEST_REDIRECTED'
  url: string
  method: string
  graphqlOperationName: string | null
  ruleId: string
  ruleName: string
  redirectedTo: string
}

export type PortMessage = RequestMockedMessage | RequestPayloadMockedMessage | RequestProxyResponseMessage | RequestHeadersModifiedMessage | RequestQueryParamsModifiedMessage | RequestRedirectedMessage
