import type { KeyValuePair } from '@/panel/store/request-sender-store'
import { generateId } from '@/shared/id-gen'

interface KeyValueEditorProps {
  pairs: KeyValuePair[]
  onChange: (pairs: KeyValuePair[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  isBrowserControlled?: (key: string) => boolean
}

export function KeyValueEditor({ pairs, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value', isBrowserControlled }: KeyValueEditorProps) {
  const update = (id: string, field: Partial<KeyValuePair>) => {
    onChange(pairs.map((p) => (p.id === id ? { ...p, ...field } : p)))
  }

  const remove = (id: string) => onChange(pairs.filter((p) => p.id !== id))

  const add = () =>
    onChange([...pairs, { id: generateId(), key: '', value: '', enabled: true }])

  return (
    <div className="flex flex-col gap-1">
      {pairs.map((pair) => {
        const browserControlled = isBrowserControlled ? isBrowserControlled(pair.key) : false
        return (
          <div key={pair.id} className={`flex items-center gap-1.5 ${browserControlled ? 'opacity-50' : ''}`}>
            {browserControlled ? (
              <span className="shrink-0 w-4 h-4 flex items-center justify-center" title="Added automatically by the browser">
                🔒
              </span>
            ) : (
              <input
                type="checkbox"
                checked={pair.enabled}
                onChange={(e) => update(pair.id, { enabled: e.target.checked })}
                className="shrink-0 accent-blue-600 cursor-pointer"
              />
            )}
            <input
              type="text"
              value={pair.key}
              readOnly={browserControlled}
              onChange={browserControlled ? undefined : (e) => update(pair.id, { key: e.target.value })}
              placeholder={keyPlaceholder}
              className={`w-2/5 min-w-0 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs font-mono focus:outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 ${browserControlled ? 'cursor-default select-text' : 'focus:ring-1 focus:ring-blue-500'}`}
            />
            <input
              type="text"
              value={pair.value}
              readOnly={browserControlled}
              onChange={browserControlled ? undefined : (e) => update(pair.id, { value: e.target.value })}
              placeholder={valuePlaceholder}
              className={`flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs font-mono focus:outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 ${browserControlled ? 'cursor-default select-text' : 'focus:ring-1 focus:ring-blue-500'}`}
            />
            {browserControlled ? (
              <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium" title="Added automatically by the browser">auto</span>
              </span>
            ) : (
              <button
                onClick={() => remove(pair.id)}
                className="shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 cursor-pointer rounded"
                title="Remove"
              >
                ×
              </button>
            )}
          </div>
        )
      })}
      <button
        onClick={add}
        className="self-start mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
      >
        + Add
      </button>
    </div>
  )
}
