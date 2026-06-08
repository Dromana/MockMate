import { useMemo, useState } from 'react'
import { prettyPrint, detectFormat } from '@/shared/pretty-print'

interface ResponsePaneProps {
  status: number | null
  statusText: string | null
  headers: Record<string, string> | null
  body: string | null
  duration: number | null
  error: string | null
  loading: boolean
}

type ResponseTab = 'body' | 'headers'

function statusColor(status: number): string {
  if (status >= 500) return 'text-red-600 dark:text-red-400'
  if (status >= 400) return 'text-orange-600 dark:text-orange-400'
  if (status >= 300) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
}

export function ResponsePane({ status, statusText, headers, body, duration, error, loading }: ResponsePaneProps) {
  const [tab, setTab] = useState<ResponseTab>('body')
  const [pretty, setPretty] = useState(false)

  const format = useMemo(
    () => detectFormat('fetch', headers?.['content-type']),
    [headers],
  )

  const displayBody = useMemo(() => {
    if (!body || !pretty) return body
    return prettyPrint(body, format)
  }, [body, pretty, format])

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-gray-400 dark:text-gray-500">
        <svg className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Sending request…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-1 p-3">
        <span className="text-xs font-semibold text-red-600 dark:text-red-400">Request failed</span>
        <pre className="text-xs font-mono text-red-500 dark:text-red-400 whitespace-pre-wrap break-all">{error}</pre>
      </div>
    )
  }

  if (status === null) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-400 dark:text-gray-500 italic">
        Send a request to see the response
      </div>
    )
  }

  const headerCount = headers ? Object.keys(headers).length : 0

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
        <span className={`text-xs font-semibold font-mono ${statusColor(status)}`}>
          {status} {statusText}
        </span>
        {duration !== null && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{duration}ms</span>
        )}
        {body !== null && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{new Blob([body]).size} B</span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-100 dark:border-gray-700 shrink-0">
        {(['body', 'headers'] as ResponseTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium cursor-pointer capitalize ${
              tab === t
                ? 'border-b-2 border-blue-600 text-blue-700'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t}
            {t === 'headers' && headerCount > 0 && (
              <span className="ml-1 text-gray-400 dark:text-gray-500">({headerCount})</span>
            )}
          </button>
        ))}

        {tab === 'body' && body !== null && format !== 'unknown' && (
          <button
            onClick={() => setPretty((p) => !p)}
            className={`ml-auto mr-2 self-center px-2 py-0.5 rounded text-xs font-mono cursor-pointer ${
              pretty
                ? 'bg-gray-800 dark:bg-gray-700 text-gray-100'
                : 'bg-gray-800/60 dark:bg-gray-700/60 text-gray-300 hover:bg-gray-800 dark:hover:bg-gray-700 hover:text-gray-100'
            }`}
          >
            {'{ }'} pretty
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-2">
        {tab === 'body' && (
          body ? (
            <pre className="text-xs font-mono whitespace-pre-wrap break-all text-gray-900 dark:text-gray-100">
              {displayBody}
            </pre>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">No response body</p>
          )
        )}

        {tab === 'headers' && (
          headers && headerCount > 0 ? (
            <div className="flex flex-col gap-0.5 font-mono text-xs">
              {Object.entries(headers).map(([name, value]) => (
                <div key={name} className="flex gap-2 min-w-0">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">{name}:</span>
                  <span className="text-gray-800 dark:text-gray-200 break-all">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">No response headers</p>
          )
        )}
      </div>
    </div>
  )
}
