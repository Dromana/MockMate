import { handleMessage } from './message-handler'
import { handleDebuggerEvent, handleDebuggerDetach, detachFromTab } from './debugger-manager'
import { registerLogPort } from './log-broadcaster'
import { createLogger } from '@/shared/logger'


const logger = createLogger('background')

chrome.runtime.onMessage.addListener(handleMessage)
chrome.debugger.onEvent.addListener(handleDebuggerEvent)
chrome.debugger.onDetach.addListener(handleDebuggerDetach)

chrome.tabs.onRemoved.addListener((tabId) => {
  detachFromTab(tabId).catch(() => {})
})

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'network-log') {
    registerLogPort(port)
  }
})

logger.info('Service worker started')
