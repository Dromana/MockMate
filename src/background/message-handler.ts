import { ExtensionMessage, FetchResult, StatusResponse } from '@/types'
import {
  attachToTab,
  detachFromTab,
  updateRules,
  isAttached,
} from './debugger-manager'
import { createLogger } from '@/shared/logger'

const logger = createLogger('message-handler')

export function handleMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean {
  switch (message.type) {
    case 'ATTACH_DEBUGGER':
      attachToTab(message.tabId)
        .then((result) => sendResponse(result))
        .catch((err) => {
          logger.error('ATTACH_DEBUGGER failed', err)
          sendResponse({ success: false, error: String(err) })
        })
      return true

    case 'DETACH_DEBUGGER':
      detachFromTab(message.tabId)
        .then(() => sendResponse({ success: true }))
        .catch((err) => {
          logger.error('DETACH_DEBUGGER failed', err)
          sendResponse({ success: false, error: String(err) })
        })
      return true

    case 'UPDATE_RULES':
      updateRules(message.rules, message.isGloballyEnabled)
      sendResponse({ success: true })
      return false

    case 'GET_STATUS': {
      const response: StatusResponse = {
        attached: isAttached(message.tabId),
        tabId: message.tabId,
      }
      sendResponse(response)
      return false
    }

    case 'EXECUTE_FETCH': {
      const { tabId, method, url, headers, body } = message
      chrome.scripting.executeScript({
        target: { tabId },
        func: async (m: string, u: string, h: Record<string, string>, b: string | null) => {
          const start = Date.now()
          try {
            const res = await fetch(u, {
              method: m,
              headers: h,
              body: b ?? undefined,
              credentials: 'include',
            })
            const resBody = await res.text()
            const resHeaders: Record<string, string> = {}
            res.headers.forEach((val, key) => { resHeaders[key] = val })
            return { ok: true as const, status: res.status, statusText: res.statusText, headers: resHeaders, body: resBody, duration: Date.now() - start }
          } catch (err) {
            return { ok: false as const, error: String(err), duration: Date.now() - start }
          }
        },
        args: [method, url, headers, body],
      })
        .then((results) => {
          sendResponse((results[0]?.result ?? { ok: false, error: 'No result from page', duration: 0 }) as FetchResult)
        })
        .catch((err: unknown) => {
          sendResponse({ ok: false, error: String(err), duration: 0 } satisfies FetchResult)
        })
      return true
    }

    default:
      logger.warn('Unknown message type', message)
      return false
  }
}
