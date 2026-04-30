import { useRulesStore } from '@/panel/store/rules-store'
import { useDebuggerStatus } from '@/panel/hooks/useDebuggerStatus'

export function StatusBar() {
  const { attached, tabId } = useDebuggerStatus()
  const rules = useRulesStore((s) => s.rules)
  const activeCount = rules.filter((r) => r.enabled).length

  const activeInjectRules = rules.filter((r) => r.enabled && r.action === 'inject_script')
  const jsCount  = activeInjectRules.filter((r) => (r.injectScript?.codeType ?? 'js') === 'js').length
  const cssCount = activeInjectRules.filter((r) => r.injectScript?.codeType === 'css').length

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
      <div className="flex items-center gap-2">
        <span>
          {rules.length === 0
            ? 'No rules'
            : `${activeCount} active · ${rules.length - activeCount} disabled`}
        </span>
        {jsCount > 0 && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 font-mono font-semibold">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            JS ×{jsCount}
          </span>
        )}
        {cssCount > 0 && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono font-semibold">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 3h16l-1.5 15L12 21l-6.5-3L4 3z" />
              <path d="M8 8h8M8 12h6M9 16h4" />
            </svg>
            CSS ×{cssCount}
          </span>
        )}
      </div>
      <span className={`flex items-center gap-1 ${attached ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${attached ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
        {attached ? `Attached to tab ${tabId}` : 'Not attached'}
      </span>
    </div>
  )
}
