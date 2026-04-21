import { create } from 'zustand'
import { MockRule } from '@/types'

export interface RulePrefill {
  name?: string
  urlPattern?: string
  urlPatternType?: 'glob' | 'exact' | 'regex'
  methods?: string[]
  statusCode?: number
  body?: string
  bodyType?: 'json' | 'html' | 'text' | 'empty'
  responseHeaders?: Record<string, string>
  graphqlOperationName?: string
  action?: 'mock_response' | 'mock_request' | 'modify_query_params'
  requestBody?: string
  requestHeaders?: Record<string, string>
  queryParams?: [string, string][]
}

interface UIStore {
  isEditorOpen: boolean
  editingRule: MockRule | null
  prefillValues: RulePrefill | null
  searchQuery: string
  isDark: boolean
  openEditor: (rule?: MockRule | null, prefill?: RulePrefill) => void
  closeEditor: () => void
  setSearchQuery: (query: string) => void
  toggleDark: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  isEditorOpen: false,
  editingRule: null,
  prefillValues: null,
  searchQuery: '',
  isDark: localStorage.getItem('theme') === 'dark',

  openEditor: (rule, prefill) =>
    set({ isEditorOpen: true, editingRule: rule ?? null, prefillValues: prefill ?? null }),
  closeEditor: () =>
    set({ isEditorOpen: false, editingRule: null, prefillValues: null }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  toggleDark: () =>
    set((state) => {
      const next = !state.isDark
      localStorage.setItem('theme', next ? 'dark' : 'light')
      if (next) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      return { isDark: next }
    }),
}))
