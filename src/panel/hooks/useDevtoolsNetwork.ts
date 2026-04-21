import { useEffect } from 'react'
import { useLogStore } from '@/panel/store/log-store'
import { RequestLogEntry } from '@/types'
import { parseGraphQL } from '@/shared/graphql'

type HarHeader = { name: string; value: string }
type HarEntry = chrome.devtools.network.Request & {
  _transferSize?: number
  response: chrome.devtools.network.Request['response'] & {
    _transferSize?: number
    content: { size: number; mimeType: string }
  }
}

function headersToRecord(headers: HarHeader[]): Record<string, string> {
  const record: Record<string, string> = {}
  for (const h of headers) {
    record[h.name.toLowerCase()] = h.value
  }
  return record
}

function getResourceType(mimeType: string, url: string): string {
  const m = mimeType.toLowerCase()
  if (m.includes('text/html')) return 'document'
  if (m.includes('javascript') || m.includes('ecmascript')) return 'script'
  if (m.includes('text/css')) return 'stylesheet'
  if (m.startsWith('image/') || m.includes('svg')) return 'image'
  if (m.includes('font') || m.includes('woff')) return 'font'
  if (m.includes('manifest') || url.endsWith('manifest.json')) return 'manifest'
  if (m.includes('json') || m.includes('xml') || m.includes('text/plain')) return 'fetch'
  // fallback: infer from URL extension
  const u = url.toLowerCase().split('?')[0]
  if (u.match(/\.m?js$/)) return 'script'
  if (u.match(/\.css$/)) return 'stylesheet'
  if (u.match(/\.(png|jpg|jpeg|gif|webp|ico|svg|avif)$/)) return 'image'
  if (u.match(/\.(woff2?|ttf|eot|otf)$/)) return 'font'
  if (u.match(/\.json$/)) return 'fetch'
  if (u.match(/\.html?$/)) return 'document'
  return 'other'
}

export function useDevtoolsNetwork(): void {
  const appendEntry = useLogStore((s) => s.appendEntry)
  const updateResponseBody = useLogStore((s) => s.updateResponseBody)
  const onNavigation = useLogStore((s) => s.onNavigation)

  useEffect(() => {
    const tabId = chrome.devtools.inspectedWindow.tabId

    function onRequestFinished(raw: chrome.devtools.network.Request) {
      const request = raw as HarEntry
      const id = crypto.randomUUID()

      const mimeType = request.response.content?.mimeType ?? ''
      const transferSize =
        typeof request.response._transferSize === 'number'
          ? request.response._transferSize
          : typeof request._transferSize === 'number'
          ? request._transferSize
          : request.response.bodySize ?? null

      const postBody = (request.request as { postData?: { text?: string } }).postData?.text
      const gql = parseGraphQL(postBody)
      const resourceType = gql ? 'graphql' : getResourceType(mimeType, request.request.url)

      // Filter out internal bypass requests made by the mock_request proxy.
      // We identify them by the _mm_bypass=1 query param embedded in the URL —
      // Chrome's HAR records the URL as the page called fetch() (before CDP strips it).
      if (request.request.url.includes('_mm_bypass=1')) return

      const reqHeaders = headersToRecord(request.request.headers as HarHeader[])
      const entry: RequestLogEntry = {
        id,
        tabId,
        method: request.request.method,
        url: request.request.url,
        requestHeaders: reqHeaders,
        requestBody: (request.request as { postData?: { text?: string } }).postData?.text ?? null,
        timestamp: new Date(request.startedDateTime).getTime(),
        fromCache: transferSize === 0,
        status: 'passthrough',
        statusCode: request.response.status || null,
        matchedRuleId: null,
        matchedRuleName: null,
        mockResponseBody: null,
        mockResponseHeaders: null,
        mockRequestBody: null,
        mockRequestAdditionalHeaders: null,
        appliedHeaderMods: null,
        appliedQueryParamMods: null,
        redirectedTo: null,
        responseHeaders: headersToRecord(request.response.headers as HarHeader[]),
        responseBody: null,
        resourceType,
        transferSize,
        duration: typeof request.time === 'number' ? request.time : null,
        graphqlOperationName: gql?.operationName ?? null,
        graphqlOperationType: gql?.operationType ?? null,
      }
      appendEntry(entry)

      request.getContent((body, encoding) => {
        if (!body) return
        const text = encoding === 'base64' ? `[binary, base64]\n${body}` : body
        updateResponseBody(id, text)
      })
    }

    function onNavigated() {
      onNavigation()
    }

    chrome.devtools.network.onRequestFinished.addListener(onRequestFinished)
    chrome.devtools.network.onNavigated.addListener(onNavigated)

    return () => {
      chrome.devtools.network.onRequestFinished.removeListener(onRequestFinished)
      chrome.devtools.network.onNavigated.removeListener(onNavigated)
    }
  }, [appendEntry, updateResponseBody, onNavigation])
}
