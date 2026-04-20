import { Button } from '../shared/Button'

export interface HeaderEntry {
  name: string
  value: string
}

interface HeadersEditorProps {
  headers: HeaderEntry[]
  onChange: (headers: HeaderEntry[]) => void
  placeholder?: string
}

export function HeadersEditor({ headers, onChange, placeholder = 'Header-Name' }: HeadersEditorProps) {
  const addRow = () => onChange([...headers, { name: '', value: '' }])

  const updateRow = (index: number, field: keyof HeaderEntry, value: string) => {
    const updated = headers.map((h, i) => (i === index ? { ...h, [field]: value } : h))
    onChange(updated)
  }

  const removeRow = (index: number) => onChange(headers.filter((_, i) => i !== index))

  return (
    <div className="flex flex-col gap-2">
      {headers.map((header, index) => (
        <div key={index} className="flex gap-2 items-center">
          <input
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            placeholder={placeholder}
            value={header.name}
            onChange={(e) => updateRow(index, 'name', e.target.value)}
          />
          <input
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            placeholder="Value"
            value={header.value}
            onChange={(e) => updateRow(index, 'value', e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeRow(index)}
            className="text-gray-400 dark:text-gray-500 hover:text-red-500 text-sm cursor-pointer"
            aria-label="Remove header"
          >
            ×
          </button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={addRow} className="self-start">
        + Add header
      </Button>
    </div>
  )
}
