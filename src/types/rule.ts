export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'

export type UrlPatternType = 'glob' | 'regex' | 'exact'

export type BodyType = 'json' | 'html' | 'text' | 'empty'

export type RuleAction = 'mock_response' | 'mock_request' | 'modify_headers' | 'modify_query_params' | 'redirect' | 'inject_script'

export type InjectScriptTiming = 'before_load' | 'dom_ready' | 'after_load'

export interface InjectScriptConfig {
  timing: InjectScriptTiming
  codeType: 'js' | 'css'
  script: string
  scheme: 'http' | 'https' | '*'
  host: string   // e.g. 'example.com', '*.example.com', '' = all hosts
  path: string   // e.g. '/*', '/dashboard*'
}

export interface RedirectConfig {
  from: string
  to: string
  matchType: 'text' | 'regex'
}

export type HeaderOperation = 'set' | 'remove'
export type QueryParamOperation = 'set' | 'remove'

export interface HeaderModification {
  operation: HeaderOperation
  name: string
  value: string
}

export interface QueryParamModification {
  operation: QueryParamOperation
  name: string
  value: string
}

export interface HeadersModification {
  requestHeaders: HeaderModification[]
  responseHeaders: HeaderModification[]
}

export interface QueryParamsModification {
  params: QueryParamModification[]
}

export interface RequestOverride {
  body: string
  bodyType: 'json' | 'text' | 'empty'
  additionalHeaders: Record<string, string>
}

export interface HeaderMatcher {
  name: string
  value: string
  matchType: 'exact' | 'contains' | 'regex'
}

export interface MatchCondition {
  urlPattern: string
  urlPatternType: UrlPatternType
  methods: HttpMethod[]
  requestHeaders?: HeaderMatcher[]
  graphqlOperationName?: string  // if set, only match requests with this GQL operation name
}

export interface MockResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  bodyType: BodyType
  delayMs: number
}

export interface MockRule {
  id: string
  name: string
  enabled: boolean
  createdAt: number
  updatedAt: number
  match: MatchCondition
  response: MockResponse
  action?: RuleAction
  requestOverride?: RequestOverride
  headersModification?: HeadersModification
  queryParamsModification?: QueryParamsModification
  redirectConfig?: RedirectConfig
  injectScript?: InjectScriptConfig
}
