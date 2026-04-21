import { MockRule } from '@/types'
import { handleRequestPaused, handleResponseStage } from './request-interceptor'
import { loadRules, loadGlobalEnabled } from './storage'
import { createLogger } from '@/shared/logger'

const logger = createLogger('debugger')

interface AttachState {
  tabId: number
  rules: MockRule[]
  isGloballyEnabled: boolean
  mainFrameId: string | null
}

interface ResponseStagedParams {
  requestId: string
  responseStatusCode?: number
  responseHeaders?: Array<{ name: string; value: string }>
  request: { url: string; method: string; headers: Record<string, string> }
}

interface FrameNavigatedParams {
  frame: { id: string; parentId?: string; url: string }
}

interface FrameStartedLoadingParams {
  frameId: string
}

interface FrameTreeResult {
  frameTree: { frame: { id: string } }
}

const attachedTabs = new Map<number, AttachState>()

const FETCH_PATTERNS = [
  { urlPattern: '*', requestStage: 'Request' },
  { urlPattern: '*', requestStage: 'Response' },
]

async function enableFetch(tabId: number): Promise<void> {
  await chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', { patterns: FETCH_PATTERNS })
}

export async function reEnableFetch(tabId: number): Promise<void> {
  if (!attachedTabs.has(tabId)) return
  try {
    await enableFetch(tabId)
    logger.debug(`Re-enabled Fetch on tab ${tabId}`)
  } catch (err) {
    logger.warn(`Failed to re-enable Fetch on tab ${tabId}`, err)
  }
}

export async function attachToTab(tabId: number): Promise<{ success: boolean; error?: string }> {
  if (attachedTabs.has(tabId)) {
    return { success: true }
  }

  try {
    await chrome.debugger.attach({ tabId }, '1.3')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('already attached')) {
      logger.warn(`Debugger already attached to tab ${tabId}`)
    } else {
      logger.error(`Failed to attach debugger to tab ${tabId}`, err)
      return { success: false, error: msg }
    }
  }

  try {
    // Enable Page domain so we receive frame events for timely Fetch re-enable
    await chrome.debugger.sendCommand({ tabId }, 'Page.enable', {})
    // Bypass any registered service workers so CDP Fetch intercepts all requests,
    // including navigations that would otherwise be served from SW cache.
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable', {})
    await chrome.debugger.sendCommand({ tabId }, 'Network.setBypassServiceWorker', { bypass: true })
    await enableFetch(tabId)

    // Get the current main frame ID so we can distinguish it from sub-frames
    let mainFrameId: string | null = null
    try {
      const tree = (await chrome.debugger.sendCommand(
        { tabId },
        'Page.getFrameTree',
        {},
      )) as FrameTreeResult
      mainFrameId = tree.frameTree.frame.id
    } catch {
      // Not critical — we'll update it on the first frameNavigated
    }

    const rules = await loadRules()
    const isGloballyEnabled = await loadGlobalEnabled()
    attachedTabs.set(tabId, { tabId, rules, isGloballyEnabled, mainFrameId })

    logger.info(`Attached to tab ${tabId}, loaded ${rules.length} rules`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error(`Failed to enable domains on tab ${tabId}`, err)
    return { success: false, error: msg }
  }
}

export async function detachFromTab(tabId: number): Promise<void> {
  if (!attachedTabs.has(tabId)) return

  try {
    await chrome.debugger.sendCommand({ tabId }, 'Network.setBypassServiceWorker', { bypass: false })
    await chrome.debugger.sendCommand({ tabId }, 'Fetch.disable', {})
    await chrome.debugger.detach({ tabId })
  } catch (err) {
    logger.warn(`Error detaching from tab ${tabId}`, err)
  } finally {
    attachedTabs.delete(tabId)
    logger.info(`Detached from tab ${tabId}`)
  }
}

export function updateRules(rules: MockRule[], isGloballyEnabled: boolean): void {
  for (const [tabId, state] of attachedTabs) {
    attachedTabs.set(tabId, { ...state, rules, isGloballyEnabled })
  }
  logger.debug(`Updated rules cache: ${rules.length} rules, enabled=${isGloballyEnabled}`)
}

export function isAttached(tabId: number): boolean {
  return attachedTabs.has(tabId)
}

export function getAttachedTabIds(): number[] {
  return Array.from(attachedTabs.keys())
}

export function handleDebuggerEvent(
  source: chrome.debugger.Debuggee,
  method: string,
  params: unknown,
): void {
  const { tabId } = source
  if (!tabId) return

  const state = attachedTabs.get(tabId)
  if (!state) return

  // Page.frameStartedLoading fires BEFORE any resources are requested — the earliest
  // signal that a main-frame navigation has begun. Re-enable Fetch so every
  // sub-resource from the new page is intercepted. Navigation/log-clear is handled
  // in the panel via chrome.devtools.network.onNavigated (no port message needed).
  if (method === 'Page.frameStartedLoading') {
    const { frameId } = params as FrameStartedLoadingParams
    if (frameId === state.mainFrameId) {
      reEnableFetch(tabId).catch((err) => logger.error('reEnableFetch failed', err))
      logger.debug(`Main frame started loading on tab ${tabId}`)
    } else {
      reEnableFetch(tabId).catch(() => {})
    }
    return
  }

  // Page.frameNavigated: update mainFrameId for the next navigation cycle.
  // Do NOT broadcast PAGE_NAVIGATED here — frameStartedLoading already did it earlier.
  if (method === 'Page.frameNavigated') {
    const { frame } = params as FrameNavigatedParams
    if (!frame.parentId) {
      const st = attachedTabs.get(tabId)
      if (st) attachedTabs.set(tabId, { ...st, mainFrameId: frame.id })
      logger.debug(`Main frame navigated on tab ${tabId}: ${frame.url}`)
    } else {
      reEnableFetch(tabId).catch(() => {})
    }
    return
  }

  if (method === 'Fetch.requestPaused') {
    const p = params as ResponseStagedParams

    if (p.responseStatusCode !== undefined) {
      handleResponseStage(tabId, p.requestId, p.responseStatusCode, p.responseHeaders).catch(
        (err) => logger.error('Error handling response stage', err),
      )
    } else {
      handleRequestPaused(
        tabId,
        params as chrome.debugger.RequestPausedParams,
        state.rules,
        state.isGloballyEnabled,
      ).catch((err) => logger.error('Error handling request', err))
    }
  }
}

export function handleDebuggerDetach(source: chrome.debugger.Debuggee, _reason: string): void {
  const { tabId } = source
  if (!tabId) return

  if (attachedTabs.has(tabId)) {
    attachedTabs.delete(tabId)
    logger.info(`Debugger detached unexpectedly from tab ${tabId}`)
  }
}
