import { Controller, Control } from 'react-hook-form'
import { RuleFormValues } from './RuleEditorModal'
import { Button } from '../shared/Button'

type ModEntry = { operation: 'set' | 'remove'; name: string; value: string }

function ModificationsEditor({
  entries,
  onChange,
  namePlaceholder,
}: {
  entries: ModEntry[]
  onChange: (entries: ModEntry[]) => void
  namePlaceholder: string
}) {
  const add = () => onChange([...entries, { operation: 'set', name: '', value: '' }])
  const remove = (i: number) => onChange(entries.filter((_, idx) => idx !== i))
  const update = (i: number, patch: Partial<ModEntry>) =>
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select
            value={entry.operation}
            onChange={(e) => update(i, { operation: e.target.value as 'set' | 'remove' })}
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shrink-0"
          >
            <option value="set">Set</option>
            <option value="remove">Remove</option>
          </select>
          <input
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            placeholder={namePlaceholder}
            value={entry.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          {entry.operation === 'set' && (
            <input
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="Value"
              value={entry.value}
              onChange={(e) => update(i, { value: e.target.value })}
            />
          )}
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-gray-400 dark:text-gray-500 hover:text-red-500 text-sm cursor-pointer shrink-0"
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={add} className="self-start">
        + Add header
      </Button>
    </div>
  )
}

interface ModifyHeadersSectionProps {
  control: Control<RuleFormValues>
}

export function ModifyHeadersSection({ control }: ModifyHeadersSectionProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Request Headers
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Applied before the request is sent to the server.
        </p>
        <Controller
          name="headersModification.requestHeaders"
          control={control}
          render={({ field }) => (
            <ModificationsEditor
              entries={field.value ?? []}
              onChange={field.onChange}
              namePlaceholder="Header-Name"
            />
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Response Headers
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Applied to the response returned to the page.
        </p>
        <Controller
          name="headersModification.responseHeaders"
          control={control}
          render={({ field }) => (
            <ModificationsEditor
              entries={field.value ?? []}
              onChange={field.onChange}
              namePlaceholder="Header-Name"
            />
          )}
        />
      </div>
    </div>
  )
}
