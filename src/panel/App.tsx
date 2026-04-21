import { useEffect, useState } from 'react'
import { Header } from './components/layout/Header'
import { StatusBar } from './components/layout/StatusBar'
import { RuleList } from './components/rules/RuleList'
import { NetworkLog } from './components/network/NetworkLog'
import { RuleEditorModal } from './components/rule-editor/RuleEditorModal'
import { useRulesStore } from './store/rules-store'
import { useUIStore } from './store/ui-store'
import { useLogPort } from './hooks/useLogPort'
import { useDevtoolsNetwork } from './hooks/useDevtoolsNetwork'
import { Button } from './components/shared/Button'

type Section = 'network' | 'rules'

const NAV: { id: Section; label: string }[] = [
  { id: 'network', label: 'Network Traffic' },
  { id: 'rules', label: 'Rule Executions' },
]

export default function App() {
  const [section, setSection] = useState<Section>('network')
  const loadFromStorage = useRulesStore((s) => s.loadFromStorage)
  const rules = useRulesStore((s) => s.rules)
  const isGloballyEnabled = useRulesStore((s) => s.isGloballyEnabled)
  const { openEditor, searchQuery, setSearchQuery } = useUIStore()

  // Log all network requests via devtools API (captures cache hits, no debugger banner)
  useDevtoolsNetwork()
  // Receive mock notifications from the service worker
  useLogPort()

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  // Attach the debugger only when mocking is actually needed.
  // This keeps the "Extension started debugging" banner hidden during pure inspection.
  useEffect(() => {
    const tabId = chrome.devtools?.inspectedWindow?.tabId
    if (!tabId) return

    const hasEnabledRules = rules.some((r) => r.enabled)
    const shouldAttach = isGloballyEnabled && hasEnabledRules

    if (shouldAttach) {
      chrome.runtime.sendMessage({ type: 'ATTACH_DEBUGGER', tabId }, (response) => {
        if (chrome.runtime.lastError) return
        if (!response?.success) {
          console.warn('[MockMate] Failed to attach debugger:', response?.error)
        }
      })
    } else {
      chrome.runtime.sendMessage({ type: 'DETACH_DEBUGGER', tabId }, () => {
        chrome.runtime.lastError // consume to suppress unchecked error
      })
    }
  }, [rules, isGloballyEnabled])

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm overflow-hidden">
      <Header />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        <nav className="w-40 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col pt-1">
          {NAV.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`text-left px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                section === id
                  ? 'bg-white dark:bg-gray-900 border-r-2 border-blue-600 text-blue-700'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          {section === 'network' && <NetworkLog />}

          {section === 'rules' && (
            <>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-700 shrink-0">
                <Button variant="primary" size="sm" onClick={() => openEditor()}>
                  + New Rule
                </Button>
                <input
                  type="search"
                  placeholder="Search rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
              <RuleList />
            </>
          )}
        </div>
      </div>

      <StatusBar />
      <RuleEditorModal />
    </div>
  )
}
