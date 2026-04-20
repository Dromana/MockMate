import { BodyType } from '@/types'

interface BodyEditorProps {
  body: string
  bodyType: BodyType
  onBodyChange: (body: string) => void
  onBodyTypeChange: (type: BodyType) => void
  error?: string
}

export function BodyEditor({ body, bodyType, onBodyChange, onBodyTypeChange, error }: BodyEditorProps) {
  const formatJson = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(body), null, 2)
      onBodyChange(formatted)
    } catch {
      // invalid JSON, leave as-is
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Body</label>
        <div className="flex gap-1">
          {(['json', 'html', 'text', 'empty'] as BodyType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onBodyTypeChange(type)}
              className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${
                bodyType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        {bodyType === 'json' && (
          <button
            type="button"
            onClick={formatJson}
            className="ml-auto px-2 py-0.5 rounded text-xs font-mono bg-gray-800 dark:bg-gray-700 text-gray-100 hover:bg-gray-700 dark:hover:bg-gray-600 cursor-pointer"
          >
            {'{ }'} pretty
          </button>
        )}
      </div>

      {bodyType !== 'empty' && (
        <>
          <textarea
            className={`w-full border rounded px-2 py-1.5 text-xs font-mono resize-y min-h-[120px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${
              error ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder={bodyType === 'json' ? '{\n  "key": "value"\n}' : 'Response body text'}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            spellCheck={false}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </>
      )}
    </div>
  )
}
