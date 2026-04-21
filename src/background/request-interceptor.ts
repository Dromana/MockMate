import { MockRule, HeaderModification, QueryParamModification, RedirectConfig } from '@/types'
import { findMatchingRule } from './rule-matcher'
import { broadcastLogMessage } from './log-broadcaster'
import { parseGraphQL } from '@/shared/graphql'
import { createLogger } from '@/shared/logger'

const logger = createLogger('interceptor')

// Header used to mark requests made internally by mock_request proxying,
// so they pass through the interceptor without being mocked again.
const BYPASS_HEADER = 'x-mockmate-bypass'

// Pending response header modifications for modify_headers rules, keyed by requestId.
const pendingResponseHeaderMods = new Map<string, HeaderModification[]>()

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

// Query param appended to the bypass fetch URL so the panel can filter it
// from the HAR log synchronously (timing-independent, unlike port messages).
// Chrome's HAR records the URL as the page called fetch() — before CDP strips it.
const BYPASS_PARAM = '_mm_bypass=1'

function encodeBody(body: string): string {
  const bytes = new TextEncoder().encode(body)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export async function handleRequestPaused(
  tabId: number,
  params: chrome.debugger.RequestPausedParams,
  rules: MockRule[],
  isGloballyEnabled: boolean,
): Promise<void> {
  const { requestId, request } = params

  // Check if this is a bypass request (made by Runtime.evaluate proxying for mock_request).
  // Must be handled before everything else — even when globally disabled — to avoid hanging.
  const isBypassRequest = Object.keys(request.headers ?? {}).some(
    (k) => k.toLowerCase() === BYPASS_HEADER,
  )
  if (isBypassRequest) {
    // Strip the bypass header and the _mm_bypass URL param before hitting the real server.
    const cleanedHeaders = Object.entries(request.headers ?? {})
      .filter(([k]) => k.toLowerCase() !== BYPASS_HEADER)
      .map(([name, value]) => ({ name, value }))

    // Remove _mm_bypass=1 from the URL (handle both ?_mm_bypass=1 and &_mm_bypass=1)
    const cleanUrl = request.url
      .replace(/([?&])_mm_bypass=1&/, '$1') // param in the middle
      .replace(/[?&]_mm_bypass=1$/, '')      // param at the end

    try {
      await chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', {
        requestId,
        url: cleanUrl !== request.url ? cleanUrl : undefined,
        headers: cleanedHeaders,
      })
    } catch (err) {
      logger.warn('Failed to continue bypass request', err)
      await continueRequest(tabId, requestId)
    }
    return
  }

  if (!isGloballyEnabled) {
    await continueRequest(tabId, requestId)
    return
  }

  const matchedRule = findMatchingRule(
    {
      url: request.url,
      method: request.method,
      body: request.postData,
      requestHeaders: Object.entries(request.headers ?? {}).map(([name, value]) => ({ name, value })),
    },
    rules,
  )

  if (!matchedRule) {
    await continueRequest(tabId, requestId)
    return
  }

  logger.info(`Matched rule "${matchedRule.name}" for ${request.method} ${request.url}`)

  const gql = parseGraphQL(request.postData)

  if (matchedRule.action === 'mock_request') {
    const override = matchedRule.requestOverride
    const hasBodyOverride = override?.bodyType !== 'empty'
    const bodyStr = override?.body ?? ''
    const additionalHeaders = override?.additionalHeaders ?? {}

    broadcastLogMessage({
      type: 'REQUEST_PAYLOAD_MOCKED',
      url: request.url,
      method: request.method,
      graphqlOperationName: gql?.operationName ?? null,
      ruleId: matchedRule.id,
      ruleName: matchedRule.name,
      mockRequestBody: hasBodyOverride ? bodyStr : null,
      additionalHeaders,
    })

    // Build merged headers:
    //   1. Start with original headers
    //   2. Drop content-length/transfer-encoding (browser recalculates from new body)
    //   3. Override with any additionalHeaders from the rule
    //   4. Add bypass header so the proxied fetch isn't intercepted again
    const STRIP = new Set(['content-length', 'transfer-encoding'])
    const additionalHeadersLower = Object.fromEntries(
      Object.entries(additionalHeaders).map(([k, v]) => [k.toLowerCase(), v]),
    )
    const mergedHeaders: Record<string, string> = {}

    for (const [name, value] of Object.entries(request.headers ?? {})) {
      const lower = name.toLowerCase()
      if (STRIP.has(lower)) continue
      if (lower in additionalHeadersLower) continue
      mergedHeaders[name] = value
    }
    for (const [name, value] of Object.entries(additionalHeaders)) {
      mergedHeaders[name] = value
    }
    mergedHeaders[BYPASS_HEADER] = '1'

    // Determine the body to send: rule override takes precedence, otherwise original postData.
    const effectiveBody: string | undefined = hasBodyOverride
      ? bodyStr
      : (request.postData ?? undefined)

    // Append _mm_bypass=1 to the URL so the panel can identify and discard this
    // HAR entry synchronously — timing-independent, unlike port messages.
    // Chrome's HAR records the URL as the page requested it (before CDP modifies it).
    const rawUrl = request.url
    const bypassUrl = rawUrl + (rawUrl.includes('?') ? '&' : '?') + BYPASS_PARAM

    const fetchUrl = JSON.stringify(bypassUrl)
    const fetchMethod = JSON.stringify(request.method)
    const fetchHeaders = JSON.stringify(mergedHeaders)
    const fetchBody = effectiveBody !== undefined ? JSON.stringify(effectiveBody) : 'undefined'

    // Execute the modified fetch in the page's JS context so that cookies, CORS,
    // and credentials are all handled exactly as the original request would be.
    const script = `
      (async () => {
        try {
          const opts = {
            method: ${fetchMethod},
            headers: ${fetchHeaders},
            credentials: 'include',
            cache: 'no-store',
          };
          if (${fetchBody} !== undefined) opts.body = ${fetchBody};
          const res = await fetch(${fetchUrl}, opts);
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const body = btoa(binary);
          const headers = {};
          res.headers.forEach((v, k) => { headers[k] = v; });
          return JSON.stringify({ ok: true, status: res.status, headers, body });
        } catch (e) {
          return JSON.stringify({ ok: false, error: String(e) });
        }
      })()
    `

    try {
      const evalResult = await chrome.debugger.sendCommand(
        { tabId },
        'Runtime.evaluate',
        {
          expression: script,
          awaitPromise: true,
          returnByValue: true,
        },
      ) as { result: { value?: string; type: string }; exceptionDetails?: object }

      if (evalResult.exceptionDetails) {
        throw new Error('Runtime.evaluate threw an exception')
      }

      const resultStr = evalResult.result?.value
      if (typeof resultStr !== 'string') {
        throw new Error(`Runtime.evaluate returned unexpected type: ${evalResult.result?.type}`)
      }

      const proxyResult = JSON.parse(resultStr) as {
        ok: boolean
        status?: number
        headers?: Record<string, string>
        body?: string
        error?: string
      }

      if (!proxyResult.ok) {
        throw new Error(`Proxy fetch failed: ${proxyResult.error}`)
      }

      // Send the real server response to the panel so the Response tab can display it.
      broadcastLogMessage({
        type: 'REQUEST_PROXY_RESPONSE',
        url: request.url,
        method: request.method,
        graphqlOperationName: gql?.operationName ?? null,
        statusCode: proxyResult.status ?? 200,
        responseBody: proxyResult.body ?? null,
        responseHeaders: proxyResult.headers ?? {},
      })

      const responseHeaders = Object.entries(proxyResult.headers ?? {}).map(([name, value]) => ({ name, value }))

      await chrome.debugger.sendCommand({ tabId }, 'Fetch.fulfillRequest', {
        requestId,
        responseCode: proxyResult.status ?? 200,
        responseHeaders,
        body: proxyResult.body ?? '',
      })
    } catch (err) {
      logger.warn('Failed to proxy request via Runtime.evaluate, falling back to passthrough', err)
      await continueRequest(tabId, requestId)
    }
    return
  }

  if (matchedRule.action === 'redirect') {
    const config = matchedRule.redirectConfig
    if (!config?.from) {
      await continueRequest(tabId, requestId)
      return
    }
    const newUrl = applyRedirect(request.url, config)
    broadcastLogMessage({
      type: 'REQUEST_REDIRECTED',
      url: request.url,
      method: request.method,
      graphqlOperationName: gql?.operationName ?? null,
      ruleId: matchedRule.id,
      ruleName: matchedRule.name,
      redirectedTo: newUrl,
    })
    try {
      await chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', {
        requestId,
        ...(newUrl !== request.url ? { url: newUrl } : {}),
      })
    } catch (err) {
      logger.warn('Failed to continue redirect request', err)
      await continueRequest(tabId, requestId)
    }
    return
  }

  if (matchedRule.action === 'modify_headers') {
    const mods = matchedRule.headersModification ?? { requestHeaders: [], responseHeaders: [] }
    const modifiedHeaders = applyHeaderMods(
      Object.fromEntries(Object.entries(request.headers ?? {})),
      mods.requestHeaders,
    )
    if (mods.responseHeaders.length > 0) {
      pendingResponseHeaderMods.set(requestId, mods.responseHeaders)
    }
    broadcastLogMessage({
      type: 'REQUEST_HEADERS_MODIFIED',
      url: request.url,
      method: request.method,
      graphqlOperationName: gql?.operationName ?? null,
      ruleId: matchedRule.id,
      ruleName: matchedRule.name,
      requestHeaderMods: mods.requestHeaders,
      responseHeaderMods: mods.responseHeaders,
    })
    try {
      await chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', {
        requestId,
        headers: Object.entries(modifiedHeaders).map(([name, value]) => ({ name, value })),
      })
    } catch (err) {
      logger.warn('Failed to continue modify_headers request', err)
      await continueRequest(tabId, requestId)
    }
    return
  }

  if (matchedRule.action === 'modify_query_params') {
    const mods = matchedRule.queryParamsModification ?? { params: [] }
    const modifiedUrl = applyQueryParamMods(request.url, mods.params)
    broadcastLogMessage({
      type: 'REQUEST_QUERY_PARAMS_MODIFIED',
      url: request.url,
      method: request.method,
      graphqlOperationName: gql?.operationName ?? null,
      ruleId: matchedRule.id,
      ruleName: matchedRule.name,
      queryParamMods: mods.params,
    })
    try {
      await chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', {
        requestId,
        ...(modifiedUrl !== request.url ? { url: modifiedUrl } : {}),
      })
    } catch (err) {
      logger.warn('Failed to continue modify_query_params request', err)
      await continueRequest(tabId, requestId)
    }
    return
  }

  // Default: mock_response behavior
  const { response } = matchedRule

  // Notify the panel so it can mark the onRequestFinished entry as mocked
  broadcastLogMessage({
    type: 'REQUEST_MOCKED',
    url: request.url,
    method: request.method,
    graphqlOperationName: gql?.operationName ?? null,
    ruleId: matchedRule.id,
    ruleName: matchedRule.name,
    statusCode: response.statusCode,
    mockResponseBody: response.bodyType !== 'empty' ? response.body : null,
    mockResponseHeaders: response.headers,
  })

  const respond = async () => {
    const responseHeaders = Object.entries(response.headers).map(([name, value]) => ({ name, value }))

    if (!responseHeaders.some((h) => h.name.toLowerCase() === 'content-type')) {
      if (response.bodyType === 'json') {
        responseHeaders.push({ name: 'Content-Type', value: 'application/json' })
      } else if (response.bodyType === 'html') {
        responseHeaders.push({ name: 'Content-Type', value: 'text/html; charset=utf-8' })
      } else if (response.bodyType === 'text') {
        responseHeaders.push({ name: 'Content-Type', value: 'text/plain' })
      }
    }

    await chrome.debugger.sendCommand({ tabId }, 'Fetch.fulfillRequest', {
      requestId,
      responseCode: response.statusCode,
      responseHeaders,
      body: response.bodyType !== 'empty' ? encodeBody(response.body) : '',
    })
  }

  if (response.delayMs > 0) {
    setTimeout(respond, response.delayMs)
  } else {
    await respond()
  }
}

export async function handleResponseStage(
  tabId: number,
  requestId: string,
  _responseStatusCode?: number,
  currentHeaders?: Array<{ name: string; value: string }>,
): Promise<void> {
  const responseMods = pendingResponseHeaderMods.get(requestId)
  if (responseMods && responseMods.length > 0) {
    pendingResponseHeaderMods.delete(requestId)
    const existing: Record<string, string> = {}
    for (const { name, value } of (currentHeaders ?? [])) existing[name] = value
    const modified = applyHeaderMods(existing, responseMods)
    const modifiedHeaders = Object.entries(modified).map(([name, value]) => ({ name, value }))
    try {
      await chrome.debugger.sendCommand({ tabId }, 'Fetch.continueResponse', {
        requestId,
        responseHeaders: modifiedHeaders,
      })
    } catch (err) {
      logger.warn('Failed to continue response with modified headers', err)
      try { await chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', { requestId }) } catch {}
    }
    return
  }
  // Just continue — the panel logs response details via onRequestFinished
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', { requestId })
  } catch (err) {
    logger.warn('Failed to continue response stage', err)
  }
}

async function continueRequest(tabId: number, requestId: string): Promise<void> {
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', { requestId })
  } catch (err) {
    logger.warn('Failed to continue request', err)
  }
}
