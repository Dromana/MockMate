import { ExtensionMessage, StatusResponse } from '@/types'
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

    default:
      logger.warn('Unknown message type', message)
      return false
  }
}
