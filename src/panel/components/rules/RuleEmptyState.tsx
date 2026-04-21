import { Button } from '../shared/Button'
import { useUIStore } from '@/panel/store/ui-store'

export function RuleEmptyState() {
  const openEditor = useUIStore((s) => s.openEditor)
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center py-12">
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl">
        ~
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">No mock rules yet</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Create a rule to start intercepting requests</p>
      </div>
      <Button variant="primary" onClick={() => openEditor()}>New Rule</Button>
    </div>
  )
}
