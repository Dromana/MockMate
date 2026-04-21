import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock chrome API
const storageMock = new Map<string, unknown>()

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
        const result: Record<string, unknown> = {}
        const keyList = Array.isArray(keys) ? keys : [keys]
        for (const key of keyList) {
          if (storageMock.has(key)) result[key] = storageMock.get(key)
        }
        return result
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(items)) {
          storageMock.set(key, value)
        }
      }),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    lastError: null,
    onMessage: { addListener: vi.fn() },
  },
  debugger: {
    attach: vi.fn(),
    detach: vi.fn(),
    sendCommand: vi.fn(),
    onEvent: { addListener: vi.fn() },
    onDetach: { addListener: vi.fn() },
  },
  tabs: {
    onRemoved: { addListener: vi.fn() },
  },
  devtools: {
    inspectedWindow: { tabId: 1 },
    panels: { create: vi.fn() },
  },
}

Object.defineProperty(global, 'chrome', { value: chromeMock, writable: true })

beforeEach(() => {
  storageMock.clear()
  vi.clearAllMocks()
})
