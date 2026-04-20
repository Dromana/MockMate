import { useRulesStore } from '@/panel/store/rules-store'
import { useUIStore } from '@/panel/store/ui-store'
import { RuleListItem } from './RuleListItem'
import { RuleEmptyState } from './RuleEmptyState'

export function RuleList() {
  const rules = useRulesStore((s) => s.rules)
  const searchQuery = useUIStore((s) => s.searchQuery)

  const filtered = rules.filter((r) => {
    const q = searchQuery.toLowerCase()
    return (
      r.name.toLowerCase().includes(q) ||
      r.match.urlPattern.toLowerCase().includes(q)
    )
  })

  if (rules.length === 0) return <RuleEmptyState />

  return (
    <div className="flex-1 overflow-auto">
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No rules match your search</p>
      ) : (
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 w-10">On</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Method</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Name / URL Pattern</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 text-center">Status</th>
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((rule) => (
              <RuleListItem key={rule.id} rule={rule} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
