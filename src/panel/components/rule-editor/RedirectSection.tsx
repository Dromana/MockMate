import { useState } from 'react'
import { Controller, Control, useWatch } from 'react-hook-form'
import { RuleFormValues } from './RuleEditorModal'

interface RedirectSectionProps {
  control: Control<RuleFormValues>
}

function computePreview(previewUrl: string, from: string, to: string, matchType: 'text' | 'regex'): string | null {
  if (!previewUrl || !from) return null
  try {
    if (matchType === 'regex') return previewUrl.replace(new RegExp(from, 'g'), to)
    return previewUrl.split(from).join(to)
  } catch {
    return null
  }
}

export function RedirectSection({ control }: RedirectSectionProps) {
  const [previewUrl, setPreviewUrl] = useState('')

  const matchType = useWatch({ control, name: 'redirectConfig.matchType' }) ?? 'text'
  const from = useWatch({ control, name: 'redirectConfig.from' }) ?? ''
  const to = useWatch({ control, name: 'redirectConfig.to' }) ?? ''

  const preview = computePreview(previewUrl, from, to, matchType)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Rewrites part of the request URL before it reaches the server — useful for switching
        between environments (e.g. production → staging).
      </p>

      {/* Match type */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Match Type</label>
        <Controller
          name="redirectConfig.matchType"
          control={control}
          render={({ field }) => (
            <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600 self-start">
              {(['text', 'regex'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => field.onChange(t)}
                  className={`px-3 py-1.5 text-xs font-medium cursor-pointer ${
                    field.value === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {t === 'text' ? 'Text' : 'Regex'}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Find */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Find in URL</label>
        <Controller
          name="redirectConfig.from"
          control={control}
          render={({ field }) => (
            <input
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder={matchType === 'regex' ? 'api\\.production\\.com' : 'api.production.com'}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              spellCheck={false}
            />
          )}
        />
      </div>

      {/* Replace */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Replace with</label>
        <Controller
          name="redirectConfig.to"
          control={control}
          render={({ field }) => (
            <input
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="api.staging.com"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              spellCheck={false}
            />
          )}
        />
      </div>

      {/* Live preview */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Preview</label>
        <input
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400"
          placeholder="Paste a sample URL to preview the result…"
          value={previewUrl}
          onChange={(e) => setPreviewUrl(e.target.value)}
          spellCheck={false}
        />
        {preview !== null && (
          <div className={`mt-1 px-2 py-1.5 rounded text-xs font-mono break-all ${
            preview === previewUrl
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300'
              : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
          }`}>
            {preview === previewUrl ? 'No match — URL unchanged' : preview}
          </div>
        )}
      </div>
    </div>
  )
}
