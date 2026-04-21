import { useRulesStore } from '@/panel/store/rules-store'
import { useUIStore } from '@/panel/store/ui-store'
import { Toggle } from '../shared/Toggle'
import logo from '@/assets/logo.png'

export function Header() {
  const { isGloballyEnabled, setGloballyEnabled } = useRulesStore()
  const { isDark, toggleDark } = useUIStore()

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <img src={logo} alt="MockMate" className="h-7 w-7 rounded object-cover" />
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">MockMate</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">devtools request interceptor</span>
      </div>
      <div className="flex items-center gap-3">
        <Toggle
          checked={isGloballyEnabled}
          onChange={setGloballyEnabled}
          label={isGloballyEnabled ? 'Intercepting' : 'Paused'}
        />
        <button
          onClick={toggleDark}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="text-base leading-none text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer transition-colors"
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>
    </div>
  )
}
