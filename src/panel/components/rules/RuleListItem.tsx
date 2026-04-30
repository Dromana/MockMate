import { useState } from 'react'
import { MockRule } from '@/types'
import { Toggle } from '../shared/Toggle'
import { MethodBadge, StatusBadge, InjectBadge } from '../shared/Badge'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useRulesStore } from '@/panel/store/rules-store'
import { useUIStore } from '@/panel/store/ui-store'

interface RuleListItemProps {
  rule: MockRule
}

export function RuleListItem({ rule }: RuleListItemProps) {
  const { toggleRule, deleteRule } = useRulesStore()
  const { openEditor } = useUIStore()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      <tr
        className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${!rule.enabled ? 'opacity-50' : ''}`}
        onClick={() => openEditor(rule)}
      >
        <td className="px-3 py-2 w-10" onClick={(e) => e.stopPropagation()}>
          <Toggle checked={rule.enabled} onChange={() => toggleRule(rule.id)} />
        </td>
        <td className="px-3 py-2 w-28">
          {rule.match.methods.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {rule.match.methods.map((m) => <MethodBadge key={m} method={m} />)}
            </div>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">ANY</span>
          )}
        </td>
        <td className="px-3 py-2 max-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{rule.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{rule.match.urlPattern}</p>
        </td>
        <td className="px-3 py-2 w-16 text-center">
          {rule.action === 'inject_script'
            ? <InjectBadge codeType={rule.injectScript?.codeType ?? 'js'} />
            : <StatusBadge code={rule.response.statusCode} />}
        </td>
        <td className="px-3 py-2 w-10 text-right" onClick={(e) => e.stopPropagation()}>
          <button
            className="text-gray-400 dark:text-gray-500 hover:text-red-500 cursor-pointer p-1 rounded transition-colors"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete rule"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </td>
      </tr>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Rule"
        message={`Delete "${rule.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => { deleteRule(rule.id); setConfirmDelete(false) }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
