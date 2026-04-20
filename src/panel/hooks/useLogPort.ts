import { useEffect, useRef } from 'react'
import { useLogStore } from '@/panel/store/log-store'
import { PortMessage } from '@/types'

/**
 * Maintains a long-lived port connection to the service worker.
 * Only used to receive REQUEST_MOCKED notifications — all other
 * network logging is handled by useDevtoolsNetwork via onRequestFinished.
 */
export function useLogPort(): void {
  const markAsMocked = useLogStore((s) => s.markAsMocked)
  const markAsPayloadMocked = useLogStore((s) => s.markAsPayloadMocked)
  const applyPayloadResponse = useLogStore((s) => s.applyPayloadResponse)
  const markAsHeadersModified = useLogStore((s) => s.markAsHeadersModified)
  const markAsQueryParamsModified = useLogStore((s) => s.markAsQueryParamsModified)
  const markAsRedirected = useLogStore((s) => s.markAsRedirected)
  const portRef = useRef<chrome.runtime.Port | null>(null)

  useEffect(() => {
    function connect() {
      try {
        const port = chrome.runtime.connect({ name: 'network-log' })
        portRef.current = port

        port.onMessage.addListener((msg: PortMessage) => {
          if (msg.type === 'REQUEST_MOCKED') {
            markAsMocked(
              msg.url,
              msg.method,
              msg.graphqlOperationName,
              msg.ruleId,
              msg.ruleName,
              msg.statusCode,
              msg.mockResponseBody,
              msg.mockResponseHeaders,
            )
          } else if (msg.type === 'REQUEST_PAYLOAD_MOCKED') {
            markAsPayloadMocked(
              msg.url,
              msg.method,
              msg.graphqlOperationName,
              msg.ruleId,
              msg.ruleName,
              msg.mockRequestBody,
              msg.additionalHeaders,
            )
          } else if (msg.type === 'REQUEST_PROXY_RESPONSE') {
            applyPayloadResponse(
              msg.url,
              msg.method,
              msg.graphqlOperationName,
              msg.statusCode,
              msg.responseBody,
              msg.responseHeaders,
            )
          } else if (msg.type === 'REQUEST_HEADERS_MODIFIED') {
            markAsHeadersModified(
              msg.url,
              msg.method,
              msg.graphqlOperationName,
              msg.ruleId,
              msg.ruleName,
              msg.requestHeaderMods,
              msg.responseHeaderMods,
            )
          } else if (msg.type === 'REQUEST_QUERY_PARAMS_MODIFIED') {
            markAsQueryParamsModified(
              msg.url,
              msg.method,
              msg.graphqlOperationName,
              msg.ruleId,
              msg.ruleName,
              msg.queryParamMods,
            )
          } else if (msg.type === 'REQUEST_REDIRECTED') {
            markAsRedirected(
              msg.url,
              msg.method,
              msg.graphqlOperationName,
              msg.ruleId,
              msg.ruleName,
              msg.redirectedTo,
            )
          }
        })

        port.onDisconnect.addListener(() => {
          portRef.current = null
          setTimeout(connect, 500)
        })
      } catch {
        // Extension context invalidated
      }
    }

    connect()

    return () => {
      portRef.current?.disconnect()
      portRef.current = null
    }
  }, [markAsMocked, markAsPayloadMocked, applyPayloadResponse, markAsHeadersModified, markAsQueryParamsModified, markAsRedirected])
}
