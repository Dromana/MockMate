import { useRulesStore } from '@/panel/store/rules-store'
import { useDebuggerStatus } from '@/panel/hooks/useDebuggerStatus'

export function StatusBar() {
  const { attached, tabId } = useDebuggerStatus()
  const rules = useRulesStore((s) => s.rules)
  const activeCount = rules.filter((r) => r.enabled).length

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
      <span>
        {rules.length === 0
          ? 'No rules'
          : `${activeCount} active · ${rules.length - activeCount} disabled`}
      </span>
      <span className={`flex items-center gap-1 ${attached ? 'text-green-600' : 'text-gray-400 dark:text-gray-500'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${attached ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
        {attached ? `Attached to tab ${tabId}` : 'Not attached'}
      </span>
    </div>
  )
}
