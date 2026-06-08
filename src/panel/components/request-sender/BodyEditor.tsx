import type { BodyType } from '@/panel/store/request-sender-store'

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'form', label: 'Form' },
  { value: 'raw', label: 'Raw' },
]

interface BodyEditorProps {
  body: string
  bodyType: BodyType
  onBodyChange: (body: string) => void
  onBodyTypeChange: (type: BodyType) => void
}

export function BodyEditor({ body, bodyType, onBodyChange, onBodyTypeChange }: BodyEditorProps) {
  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-1 shrink-0">
        {BODY_TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onBodyTypeChange(value)}
            className={`px-2 py-0.5 rounded text-xs cursor-pointer transition-colors ${
              bodyType === value
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {bodyType === 'none' ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">No body</p>
      ) : (
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          spellCheck={false}
          placeholder={bodyType === 'json' ? '{"key": "value"}' : bodyType === 'form' ? 'key=value&key2=value2' : 'Request body…'}
          className="flex-1 min-h-[100px] border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400"
        />
      )}
    </div>
  )
}
