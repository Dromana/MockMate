import { create } from 'zustand'
import { generateId } from '@/shared/id-gen'
import { STORAGE_KEYS } from '@/constants'
import type { FetchResult, RequestLogEntry } from '@/types'

export interface KeyValuePair {
  id: string
  key: string
  value: string
  enabled: boolean
}

export type BodyType = 'json' | 'form' | 'raw' | 'none'

export interface SavedRequest {
  id: string
  name: string
  method: string
  url: string
  headers: KeyValuePair[]
  params: KeyValuePair[]
  body: string
  bodyType: BodyType
  createdAt: number
  updatedAt: number
}

interface SenderResponse {
  status: number | null
  statusText: string | null
  headers: Record<string, string> | null
  body: string | null
  duration: number | null
  error: string | null
  loading: boolean
}

const emptyResponse: SenderResponse = {
  status: null,
  statusText: null,
  headers: null,
  body: null,
  duration: null,
  error: null,
  loading: false,
}

const SKIP_REQUEST_HEADERS = new Set([':method', ':path', ':scheme', ':authority', ':status'])

interface RequestSenderStore {
  method: string
  url: string
  headers: KeyValuePair[]
  params: KeyValuePair[]
  body: string
  bodyType: BodyType
  activeSavedRequestId: string | null

  response: SenderResponse
  savedRequests: SavedRequest[]

  setMethod(method: string): void
  setUrl(url: string): void
  setHeaders(headers: KeyValuePair[]): void
  setParams(params: KeyValuePair[]): void
  setBody(body: string): void
  setBodyType(type: BodyType): void

  loadFromLogEntry(entry: RequestLogEntry): void
  newRequest(): void
  loadSavedRequest(id: string): void
  saveCurrentRequest(name: string): void
  deleteSavedRequest(id: string): void

  sendRequest(): void
  loadFromStorage(): Promise<void>
}

export const useRequestSenderStore = create<RequestSenderStore>((set, get) => ({
  method: 'GET',
  url: '',
  headers: [],
  params: [],
  body: '',
  bodyType: 'none',
  activeSavedRequestId: null,
  response: emptyResponse,
  savedRequests: [],

  setMethod: (method) => set({ method }),
  setUrl: (url) => set({ url }),
  setHeaders: (headers) => set({ headers }),
  setParams: (params) => set({ params }),
  setBody: (body) => set({ body }),
  setBodyType: (bodyType) => set({ bodyType }),

  loadFromLogEntry: (entry) => {
    let baseUrl = entry.url
    const kvParams: KeyValuePair[] = []
    try {
      const u = new URL(entry.url)
      baseUrl = `${u.origin}${u.pathname}`
      u.searchParams.forEach((value, key) => {
        kvParams.push({ id: generateId(), key, value, enabled: true })
      })
    } catch { /* use full URL */ }

    const kvHeaders: KeyValuePair[] = Object.entries(entry.requestHeaders)
      .filter(([key]) => !SKIP_REQUEST_HEADERS.has(key.toLowerCase()))
      .map(([key, value]) => ({ id: generateId(), key, value, enabled: true }))

    const rawBody = entry.requestBody ?? ''
    let bodyType: BodyType = 'none'
    if (rawBody) {
      const ct = (entry.requestHeaders['content-type'] ?? '').toLowerCase()
      if (ct.includes('json')) bodyType = 'json'
      else if (ct.includes('form')) bodyType = 'form'
      else bodyType = 'raw'
    }

    set({
      method: entry.method,
      url: baseUrl,
      headers: kvHeaders,
      params: kvParams,
      body: rawBody,
      bodyType,
      activeSavedRequestId: null,
      response: emptyResponse,
    })
  },

  newRequest: () => set({
    method: 'GET',
    url: '',
    headers: [],
    params: [],
    body: '',
    bodyType: 'none',
    activeSavedRequestId: null,
    response: emptyResponse,
  }),

  loadSavedRequest: (id) => {
    const req = get().savedRequests.find((r) => r.id === id)
    if (!req) return
    set({
      method: req.method,
      url: req.url,
      headers: req.headers,
      params: req.params,
      body: req.body,
      bodyType: req.bodyType,
      activeSavedRequestId: id,
      response: emptyResponse,
    })
  },

  saveCurrentRequest: (name) => {
    const { method, url, headers, params, body, bodyType, activeSavedRequestId, savedRequests } = get()
    const now = Date.now()

    if (activeSavedRequestId) {
      const updated = savedRequests.map((r) =>
        r.id === activeSavedRequestId
          ? { ...r, name, method, url, headers, params, body, bodyType, updatedAt: now }
          : r,
      )
      set({ savedRequests: updated })
      persistSavedRequests(updated)
    } else {
      const newReq: SavedRequest = {
        id: generateId(),
        name,
        method,
        url,
        headers,
        params,
        body,
        bodyType,
        createdAt: now,
        updatedAt: now,
      }
      const updated = [...savedRequests, newReq]
      set({ savedRequests: updated, activeSavedRequestId: newReq.id })
      persistSavedRequests(updated)
    }
  },

  deleteSavedRequest: (id) => {
    const updated = get().savedRequests.filter((r) => r.id !== id)
    const activeSavedRequestId = get().activeSavedRequestId === id ? null : get().activeSavedRequestId
    set({ savedRequests: updated, activeSavedRequestId })
    persistSavedRequests(updated)
  },

  sendRequest: () => {
    const { method, url, headers, params, body, bodyType } = get()

    // Build final URL: strip any params already in the URL string, then add back only enabled ones
    let finalUrl = url
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      urlObj.search = ''
      params.filter((p) => p.enabled && p.key).forEach((p) => urlObj.searchParams.set(p.key, p.value))
      finalUrl = urlObj.toString()
    } catch {
      const enabledParams = params.filter((p) => p.enabled && p.key)
      const baseUrl = url.split('?')[0]
      if (enabledParams.length > 0) {
        const qs = enabledParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
        finalUrl = `${baseUrl}?${qs}`
      } else {
        finalUrl = baseUrl
      }
    }

    // Build headers object from enabled pairs
    const headersObj: Record<string, string> = {}
    headers.filter((h) => h.enabled && h.key).forEach((h) => { headersObj[h.key] = h.value })

    // Auto-add Content-Type for JSON body if not already set
    const hasContentType = Object.keys(headersObj).some((k) => k.toLowerCase() === 'content-type')
    if (bodyType === 'json' && body.trim() && !hasContentType) {
      headersObj['Content-Type'] = 'application/json'
    }

    const requestBody = bodyType !== 'none' && body.trim() ? body : null

    set({ response: { ...emptyResponse, loading: true } })

    const tabId = chrome.devtools?.inspectedWindow?.tabId
    if (!tabId) {
      set({ response: { ...emptyResponse, error: 'No inspected tab available.' } })
      return
    }

    chrome.runtime.sendMessage(
      { type: 'EXECUTE_FETCH', tabId, method, url: finalUrl, headers: headersObj, body: requestBody },
      (result: FetchResult | undefined) => {
        if (chrome.runtime.lastError) {
          set({ response: { ...emptyResponse, error: chrome.runtime.lastError.message ?? 'Extension error' } })
          return
        }
        if (!result) {
          set({ response: { ...emptyResponse, error: 'No response received.' } })
          return
        }
        if (result.ok) {
          set({
            response: {
              status: result.status,
              statusText: result.statusText,
              headers: result.headers,
              body: result.body,
              duration: result.duration,
              error: null,
              loading: false,
            },
          })
        } else {
          set({ response: { ...emptyResponse, error: result.error, duration: result.duration } })
        }
      },
    )
  },

  loadFromStorage: async () => {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SAVED_REQUESTS)
    set({ savedRequests: (result[STORAGE_KEYS.SAVED_REQUESTS] as SavedRequest[]) ?? [] })
  },
}))

function persistSavedRequests(savedRequests: SavedRequest[]): void {
  chrome.storage.local.set({ [STORAGE_KEYS.SAVED_REQUESTS]: savedRequests })
}
