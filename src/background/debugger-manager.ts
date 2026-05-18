import { MockRule, InjectScriptTiming } from '@/types'
import { handleRequestPaused, handleResponseStage } from './request-interceptor'
import { loadRules, loadGlobalEnabled } from './storage'
import { createLogger } from '@/shared/logger'

const logger = createLogger('debugger')

interface AttachState {
  tabId: number
  rules: MockRule[]
  isGloballyEnabled: boolean
  mainFrameId: string | null
  currentUrl: string | null
  // ruleId → CDP script identifier (before_load only)
  injectScriptIdentifiers: Map<string, string>
}

interface ResponseStagedParams {
  requestId: string
  responseStatusCode?: number
  responseHeaders?: Array<{ name: string; value: string }>
  request: { url: string; method: string; headers: Record<string, string>; postData?: string }
}

interface FrameNavigatedParams {
  frame: { id: string; parentId?: string; url: string }
}

interface FrameStartedLoadingParams {
  frameId: string
}

interface FrameTreeResult {
  frameTree: { frame: { id: string; url: string } }
}

interface AddScriptResult {
  identifier: string
}

interface AttachedToTargetParams {
  sessionId: string
  targetInfo: { targetId: string; type: string; url: string }
  waitingForDebugger: boolean
}

interface DetachedFromTargetParams {
  sessionId: string
  targetId?: string
}

const attachedTabs = new Map<number, AttachState>()

// Maps iframe/sub-target IDs to their parent tab ID so events from those
// targets can be routed to the correct rule state.
const attachedSubTargets = new Map<string, number>() // targetId → parentTabId

const FETCH_PATTERNS = [
  { urlPattern: '*', requestStage: 'Request' },
  { urlPattern: '*', requestStage: 'Response' },
]

// ---------------------------------------------------------------------------
// Inject script helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Scope helpers — converts InjectScriptConfig scheme/host/path into URL checks
// ---------------------------------------------------------------------------

function escRe(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&')
}

/** Builds the inline JS guard string (empty string = no restriction). */
function buildScopeGuard(config: { scheme: string; host: string; path: string }): string {
  if (!config.host) return ''
  const scheme = config.scheme === '*' ? 'https?' : config.scheme
  const hostPart = escRe(config.host).replace(/\*/g, '[^.]+')
  const pathPart =
    !config.path || config.path === '/*'
      ? ''
      : escRe(config.path).replace(/\*/g, '.*')
  const regexStr = `^${scheme}://${hostPart}${pathPart}`
  return `if (!new RegExp(${JSON.stringify(regexStr)}).test(location.href)) return;\n  `
}

/** Server-side URL check for dom_ready / after_load timings. */
function scopeMatchesUrl(
  config: { scheme: string; host: string; path: string },
  url: string,
): boolean {
  if (!config.host) return true
  try {
    const u = new URL(url)
    if (config.scheme !== '*' && u.protocol !== `${config.scheme}:`) return false
    const hostRe = new RegExp(`^${escRe(config.host).replace(/\*/g, '[^.]+')}$`)
    if (!hostRe.test(u.hostname)) return false
    if (config.path && config.path !== '/*') {
      const pathRe = new RegExp(`^${escRe(config.path).replace(/\*/g, '.*')}`)
      if (!pathRe.test(u.pathname)) return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Wraps user script in a try/catch so errors don't break the page silently.
 * For before_load scripts the URL guard is inlined so one registered script
 * handles all navigations but only runs on matching pages.
 */
function buildBeforeLoadScript(rule: MockRule): string {
  const cfg = rule.injectScript!
  const guard = buildScopeGuard(cfg)
  const safeName = rule.name.replace(/\\/g, '\\\\').replace(/`/g, '\\`')

  if (cfg.codeType === 'css') {
    // before_load runs before DOM exists — inject CSS as soon as head is available
    return `(function () {
  ${guard}try {
    var __inject = function() {
      var __s = document.createElement('style');
      __s.textContent = ${JSON.stringify(cfg.script)};
      (document.head || document.documentElement).appendChild(__s);
    };
    if (document.head) { __inject(); }
    else { document.addEventListener('DOMContentLoaded', __inject, { once: true }); }
  } catch (e) { console.warn('[MockMate inject] \`${safeName}\`:', e); }
})()`
  }

  return `(function () {
  ${guard}try {
    ${cfg.script}
  } catch (e) { console.warn('[MockMate inject] \`${safeName}\`:', e); }
})()`
}

function buildTimedScript(rule: MockRule): string {
  const cfg = rule.injectScript!
  const safeName = rule.name.replace(/\\/g, '\\\\').replace(/`/g, '\\`')

  if (cfg.codeType === 'css') {
    return `(function () {
  try {
    var __s = document.createElement('style');
    __s.textContent = ${JSON.stringify(cfg.script)};
    document.head.appendChild(__s);
  } catch (e) { console.warn('[MockMate inject] \`${safeName}\`:', e); }
})()`
  }

  return `(function () {
  try {
    ${cfg.script}
  } catch (e) { console.warn('[MockMate inject] \`${safeName}\`:', e); }
})()`
}

/**
 * Registers/unregisters Page.addScriptToEvaluateOnNewDocument for all enabled
 * inject_script rules with timing === 'before_load'.  dom_ready / after_load
 * are handled reactively via CDP events in _handleDebuggerEventAsync.
 */
async function syncBeforeLoadScripts(tabId: number, state: AttachState): Promise<void> {
  const enabledBeforeLoad = state.isGloballyEnabled
    ? state.rules.filter(
        (r) => r.enabled && r.action === 'inject_script' && r.injectScript?.timing === 'before_load',
      )
    : []

  const activeIds = new Set(enabledBeforeLoad.map((r) => r.id))

  // Remove identifiers for rules that are no longer active
  for (const [ruleId, identifier] of state.injectScriptIdentifiers) {
    if (!activeIds.has(ruleId)) {
      try {
        await chrome.debugger.sendCommand({ tabId }, 'Page.removeScriptToEvaluateOnNewDocument', {
          identifier,
        })
      } catch { /* ignore — may already be gone */ }
      state.injectScriptIdentifiers.delete(ruleId)
      logger.debug(`Removed inject script for rule ${ruleId} on tab ${tabId}`)
    }
  }

  // Register newly active rules
  for (const rule of enabledBeforeLoad) {
    if (!state.injectScriptIdentifiers.has(rule.id)) {
      try {
        const result = (await chrome.debugger.sendCommand(
          { tabId },
          'Page.addScriptToEvaluateOnNewDocument',
          { source: buildBeforeLoadScript(rule) },
        )) as AddScriptResult
        state.injectScriptIdentifiers.set(rule.id, result.identifier)
        logger.debug(`Registered before_load inject script "${rule.name}" on tab ${tabId}`)
      } catch (err) {
        logger.warn(`Failed to register inject script "${rule.name}"`, err)
      }
    }
  }
}

/**
 * Runs inject_script rules with timing dom_ready or after_load via Runtime.evaluate.
 * Called when the corresponding CDP event fires.
 */
async function runTimedInjectScripts(
  tabId: number,
  timing: Extract<InjectScriptTiming, 'dom_ready' | 'after_load'>,
  state: AttachState,
): Promise<void> {
  if (!state.isGloballyEnabled || !state.currentUrl) return

  const matching = state.rules.filter(
    (r) =>
      r.enabled &&
      r.action === 'inject_script' &&
      r.injectScript?.timing === timing &&
      scopeMatchesUrl(
        { scheme: r.injectScript.scheme, host: r.injectScript.host, path: r.injectScript.path },
        state.currentUrl!,
      ),
  )

  for (const rule of matching) {
    try {
      await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
        expression: buildTimedScript(rule),
        includeCommandLineAPI: false,
      })
      logger.debug(`Ran ${timing} inject script "${rule.name}" on tab ${tabId}`)
    } catch (err) {
      logger.warn(`Failed to run ${timing} inject script "${rule.name}"`, err)
    }
  }
}

// ---------------------------------------------------------------------------
// Core lifecycle
// ---------------------------------------------------------------------------

async function enableFetch(tabId: number): Promise<void> {
  await chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', { patterns: FETCH_PATTERNS })
}

export async function reEnableFetch(tabId: number): Promise<void> {
  if (!attachedTabs.has(tabId)) return
  try {
    await enableFetch(tabId)
    logger.debug(`Re-enabled Fetch on tab ${tabId}`)
    // Re-enable on any attached iframe sub-targets for this tab.
    for (const [targetId, pid] of attachedSubTargets) {
      if (pid !== tabId) continue
      try {
        await chrome.debugger.sendCommand({ targetId }, 'Fetch.enable', { patterns: FETCH_PATTERNS })
      } catch { /* sub-target may have gone away */ }
    }
  } catch (err) {
    logger.warn(`Failed to re-enable Fetch on tab ${tabId}`, err)
  }
}

/**
 * Attaches MockMate's debugger to an iframe sub-target and enables Fetch
 * interception on it. Called when Target.attachedToTarget fires for an iframe,
 * or when we proactively discover existing OOPIF targets via discoverExistingIframeTargets.
 */
async function attachIframeTarget(parentTabId: number, targetId: string): Promise<void> {
  if (attachedSubTargets.has(targetId)) return

  logger.info(`Attaching to iframe target ${targetId} (tab ${parentTabId})`)

  try {
    await chrome.debugger.attach({ targetId }, '1.3')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('already attached')) {
      logger.warn(`Failed to attach to iframe target ${targetId}: ${msg}`)
      return
    }
    logger.debug(`Iframe target ${targetId} was already attached — continuing to Fetch.enable`)
  }

  try {
    await chrome.debugger.sendCommand({ targetId }, 'Fetch.enable', { patterns: FETCH_PATTERNS })
    attachedSubTargets.set(targetId, parentTabId)
    logger.info(`Intercepting iframe target ${targetId} (tab ${parentTabId})`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn(`Failed to enable Fetch on iframe target ${targetId}: ${msg}`)
    try { await chrome.debugger.detach({ targetId }) } catch { /* ignore */ }
  }
}

/**
 * Proactively discovers and attaches to any OOPIF targets that already exist for
 * the given tab. Target.setAutoAttach fires Target.attachedToTarget for iframes
 * created AFTER the setAutoAttach call, but iframes that were already in the page
 * at attach-time may be missed. This function fills that gap.
 */
async function discoverExistingIframeTargets(parentTabId: number): Promise<void> {
  try {
    // First find the CDP targetId for our tab using the extension's getTargets API.
    const allTargets: chrome.debugger.TargetInfo[] = await new Promise((resolve) => {
      chrome.debugger.getTargets(resolve)
    })
    const tabTarget = allTargets.find((t) => t.tabId === parentTabId && t.type === 'page')
    if (!tabTarget?.id) {
      logger.debug(`discoverExistingIframeTargets: could not find targetId for tab ${parentTabId}`)
      return
    }

    // CDP Target.getTargets returns all browser targets with their openerId.
    // Iframe OOPIFs have openerId === parent page's targetId.
    const result = await chrome.debugger.sendCommand(
      { tabId: parentTabId },
      'Target.getTargets',
      {},
    ) as { targetInfos: Array<{ targetId: string; type: string; url: string; openerId?: string }> }

    const iframeTargets = result.targetInfos.filter(
      (t) =>
        (t.type === 'iframe' || t.type === 'page') &&
        t.openerId === tabTarget.id &&
        t.targetId !== tabTarget.id,
    )

    if (iframeTargets.length > 0) {
      logger.info(
        `Found ${iframeTargets.length} existing OOPIF target(s) for tab ${parentTabId}: ` +
        iframeTargets.map((t) => `${t.targetId} (${t.url})`).join(', '),
      )
      for (const t of iframeTargets) {
        attachIframeTarget(parentTabId, t.targetId).catch((err) =>
          logger.warn(`Failed to attach to existing iframe target ${t.targetId}`, err),
        )
      }
    } else {
      logger.debug(`discoverExistingIframeTargets: no OOPIF targets found for tab ${parentTabId} (tabTargetId=${tabTarget.id})`)
    }
  } catch (err) {
    logger.warn('discoverExistingIframeTargets failed', err)
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
    await chrome.debugger.sendCommand({ tabId }, 'Page.enable', {})
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable', {})
    await chrome.debugger.sendCommand({ tabId }, 'Network.setBypassServiceWorker', { bypass: true })
    await enableFetch(tabId)

    // Auto-attach to cross-origin iframe targets so their requests are also intercepted.
    // waitForDebuggerOnStart:false lets iframes load without pausing.
    try {
      await chrome.debugger.sendCommand({ tabId }, 'Target.setAutoAttach', {
        autoAttach: true,
        waitForDebuggerOnStart: false,
        flatten: false,
      })
    } catch (err) {
      logger.warn(`Target.setAutoAttach not supported on tab ${tabId}`, err)
    }

    // Proactively attach to any OOPIFs that already existed when we called
    // setAutoAttach — setAutoAttach only auto-notifies for iframes created AFTER
    // the call in some Chrome versions; this fallback covers pre-existing ones.
    discoverExistingIframeTargets(tabId).catch((err) =>
      logger.warn('discoverExistingIframeTargets failed', err),
    )

    let mainFrameId: string | null = null
    let currentUrl: string | null = null
    try {
      const tree = (await chrome.debugger.sendCommand(
        { tabId },
        'Page.getFrameTree',
        {},
      )) as FrameTreeResult
      mainFrameId = tree.frameTree.frame.id
      currentUrl = tree.frameTree.frame.url
    } catch { /* not critical — updated on first frameNavigated */ }

    const rules = await loadRules()
    const isGloballyEnabled = await loadGlobalEnabled()
    const state: AttachState = {
      tabId,
      rules,
      isGloballyEnabled,
      mainFrameId,
      currentUrl,
      injectScriptIdentifiers: new Map(),
    }
    attachedTabs.set(tabId, state)

    await syncBeforeLoadScripts(tabId, state)

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

  // Detach from all iframe sub-targets belonging to this tab.
  for (const [targetId, pid] of attachedSubTargets) {
    if (pid !== tabId) continue
    try {
      await chrome.debugger.sendCommand({ targetId }, 'Fetch.disable', {})
      await chrome.debugger.detach({ targetId })
    } catch { /* ignore */ }
    attachedSubTargets.delete(targetId)
  }

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
    const newState: AttachState = { ...state, rules, isGloballyEnabled }
    attachedTabs.set(tabId, newState)
    syncBeforeLoadScripts(tabId, newState).catch((err) =>
      logger.error('syncBeforeLoadScripts failed', err),
    )
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
  _handleDebuggerEventAsync(source, method, params).catch((err) =>
    logger.error('handleDebuggerEvent error', err),
  )
}

async function _handleDebuggerEventAsync(
  source: chrome.debugger.Debuggee,
  method: string,
  params: unknown,
): Promise<void> {
  // Resolve the tab ID from either the main tab or a sub-target (iframe).
  const sourceTabId = source.tabId
  const sourceTargetId = source.targetId
  const tabId = sourceTabId ?? (sourceTargetId ? attachedSubTargets.get(sourceTargetId) : undefined)

  // If this is a Fetch event from an unknown sub-target (e.g. after SW restart),
  // unblock the request rather than leaving it hanging.
  if (tabId === undefined) {
    if (method === 'Fetch.requestPaused' && sourceTargetId) {
      const p = params as ResponseStagedParams
      const cmd = p.responseStatusCode !== undefined ? 'Fetch.continueResponse' : 'Fetch.continueRequest'
      await chrome.debugger.sendCommand({ targetId: sourceTargetId }, cmd, { requestId: p.requestId }).catch(() => {})
    }
    return
  }

  // Build the debuggee to use for all CDP commands for this event.
  const debuggee: chrome.debugger.Debuggee = sourceTargetId ? { targetId: sourceTargetId } : { tabId }

  let state = attachedTabs.get(tabId)
  if (!state) {
    // MV3 service worker restarted — browser-level debugger attachment survives
    // but in-memory state was cleared. Reconstruct from storage.
    logger.info(`SW restart detected for tab ${tabId} — recovering state from storage`)
    const rules = await loadRules()
    const isGloballyEnabled = await loadGlobalEnabled()
    state = {
      tabId,
      rules,
      isGloballyEnabled,
      mainFrameId: null,
      currentUrl: null,
      injectScriptIdentifiers: new Map(),
    }
    attachedTabs.set(tabId, state)
  }

  // Page.frameStartedLoading — earliest signal of a main-frame navigation.
  // Re-enable Fetch so sub-resources from the new page are intercepted.
  if (method === 'Page.frameStartedLoading') {
    const { frameId } = params as FrameStartedLoadingParams
    if (frameId === state.mainFrameId) {
      // Clean up iframe sub-targets — they are invalidated on navigation.
      for (const [tid, pid] of attachedSubTargets) {
        if (pid !== tabId) continue
        chrome.debugger.detach({ targetId: tid }).catch(() => {})
        attachedSubTargets.delete(tid)
      }
      reEnableFetch(tabId).catch((err) => logger.error('reEnableFetch failed', err))
      logger.debug(`Main frame started loading on tab ${tabId}`)
    } else {
      reEnableFetch(tabId).catch(() => { /* ignore */ })
      // A sub-frame started loading — check if new OOPIF targets appeared.
      discoverExistingIframeTargets(tabId).catch(() => { /* non-critical */ })
    }
    return
  }

  // Page.frameNavigated — update mainFrameId and currentUrl for the next cycle.
  if (method === 'Page.frameNavigated') {
    const { frame } = params as FrameNavigatedParams
    if (!frame.parentId) {
      const st = attachedTabs.get(tabId)
      if (st) attachedTabs.set(tabId, { ...st, mainFrameId: frame.id, currentUrl: frame.url })
      logger.debug(`Main frame navigated on tab ${tabId}: ${frame.url}`)
      // Re-discover OOPIFs after main-frame navigation.
      discoverExistingIframeTargets(tabId).catch(() => { /* non-critical */ })
    } else {
      reEnableFetch(tabId).catch(() => { /* ignore */ })
      // Sub-frame navigated — check if new OOPIF targets appeared.
      discoverExistingIframeTargets(tabId).catch(() => { /* non-critical */ })
    }
    return
  }

  // Target.attachedToTarget — a new iframe sub-target was auto-attached.
  // Attach to it separately and enable Fetch interception.
  if (method === 'Target.attachedToTarget') {
    const { targetInfo } = params as AttachedToTargetParams
    logger.info(`Target.attachedToTarget: type=${targetInfo.type} targetId=${targetInfo.targetId} url=${targetInfo.url}`)
    if (targetInfo.type === 'iframe' || targetInfo.type === 'page') {
      attachIframeTarget(tabId, targetInfo.targetId).catch((err) =>
        logger.warn(`Failed to set up iframe target ${targetInfo.targetId}`, err),
      )
    }
    return
  }

  // Target.detachedFromTarget — an iframe sub-target went away.
  if (method === 'Target.detachedFromTarget') {
    const p = params as DetachedFromTargetParams
    const tid = p.targetId
    if (tid && attachedSubTargets.has(tid)) {
      attachedSubTargets.delete(tid)
      chrome.debugger.detach({ targetId: tid }).catch(() => {})
      logger.debug(`Iframe target ${tid} detached from tab ${tabId}`)
    }
    return
  }

  // Inject scripts — dom_ready and after_load timings
  if (method === 'Page.domContentEventFired') {
    runTimedInjectScripts(tabId, 'dom_ready', state).catch((err) =>
      logger.error('dom_ready inject scripts failed', err),
    )
    return
  }

  if (method === 'Page.loadEventFired') {
    runTimedInjectScripts(tabId, 'after_load', state).catch((err) =>
      logger.error('after_load inject scripts failed', err),
    )
    return
  }

  if (method === 'Fetch.requestPaused') {
    const p = params as ResponseStagedParams

    if (p.responseStatusCode !== undefined) {
      handleResponseStage(
        debuggee,
        p.requestId,
        state.rules,
        state.isGloballyEnabled,
        p.request,
        p.responseStatusCode,
        p.responseHeaders,
      ).catch((err) => logger.error('Error handling response stage', err))
    } else {
      handleRequestPaused(
        debuggee,
        params as chrome.debugger.RequestPausedParams,
        state.rules,
        state.isGloballyEnabled,
      ).catch((err) => logger.error('Error handling request', err))
    }
  }
}

export function handleDebuggerDetach(source: chrome.debugger.Debuggee, _reason: string): void {
  const { tabId, targetId } = source

  // Sub-target (iframe) detached.
  if (targetId) {
    attachedSubTargets.delete(targetId)
    return
  }

  if (tabId && attachedTabs.has(tabId)) {
    // Clean up any remaining sub-targets for this tab.
    for (const [tid, pid] of attachedSubTargets) {
      if (pid !== tabId) continue
      chrome.debugger.detach({ targetId: tid }).catch(() => {})
      attachedSubTargets.delete(tid)
    }
    attachedTabs.delete(tabId)
    logger.info(`Debugger detached unexpectedly from tab ${tabId}`)
  }
}
