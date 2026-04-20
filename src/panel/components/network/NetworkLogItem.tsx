import { RequestLogEntry } from '@/types'

interface NetworkLogItemProps {
  entry: RequestLogEntry
  isSelected: boolean
  onClick: () => void
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes <= 0) return 'cache'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1) return '< 1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function statusColor(code: number | null): string {
  if (code === null) return 'text-gray-400'
  if (code < 300) return 'text-green-700'
  if (code < 400) return 'text-yellow-600'
  return 'text-red-600'
}

export function NetworkLogItem({ entry, isSelected, onClick }: NetworkLogItemProps) {
  const bg = isSelected
    ? 'bg-blue-100 dark:bg-blue-900/40'
    : entry.status === 'mocked'
    ? 'hover:bg-purple-100 dark:hover:bg-purple-900/30 bg-purple-50 dark:bg-purple-900/20'
    : entry.status === 'payload-mocked'
    ? 'hover:bg-orange-100 dark:hover:bg-orange-900/30 bg-orange-50 dark:bg-orange-900/20'
    : entry.status === 'headers-modified'
    ? 'hover:bg-teal-100 dark:hover:bg-teal-900/30 bg-teal-50 dark:bg-teal-900/20'
    : entry.status === 'query-params-modified'
    ? 'hover:bg-cyan-100 dark:hover:bg-cyan-900/30 bg-cyan-50 dark:bg-cyan-900/20'
    : entry.status === 'redirected'
    ? 'hover:bg-amber-100 dark:hover:bg-amber-900/30 bg-amber-50 dark:bg-amber-900/20'
    : 'hover:bg-gray-50 dark:hover:bg-gray-700'

  return (
    <tr
      onClick={onClick}
      className={`border-b border-gray-100 dark:border-gray-700 cursor-pointer text-xs ${bg}`}
    >
      {/* URL */}
      <td className="pl-3 pr-2 py-1 overflow-hidden">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`font-mono truncate ${isSelected ? 'text-blue-900 dark:text-blue-200' : 'text-gray-800 dark:text-gray-200'}`}
            title={entry.url}
          >
            {entry.url}
          </span>
          {entry.graphqlOperationName && (
            <span className={`shrink-0 italic text-xs ${isSelected ? 'text-blue-400' : 'text-indigo-500'}`}>
              ({entry.graphqlOperationName})
            </span>
          )}
          {entry.status === 'mocked' && (
            <span className="shrink-0 px-1 py-0.5 rounded text-xs font-medium bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200">
              mocked
            </span>
          )}
          {entry.status === 'payload-mocked' && (
            <span className="shrink-0 px-1 py-0.5 rounded text-xs font-medium bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200">
              req mocked
            </span>
          )}
          {entry.status === 'headers-modified' && (
            <span className="shrink-0 px-1 py-0.5 rounded text-xs font-medium bg-teal-200 dark:bg-teal-800 text-teal-800 dark:text-teal-200">
              hdrs modified
            </span>
          )}
          {entry.status === 'query-params-modified' && (
            <span className="shrink-0 px-1 py-0.5 rounded text-xs font-medium bg-cyan-200 dark:bg-cyan-800 text-cyan-800 dark:text-cyan-200">
              params modified
            </span>
          )}
          {entry.status === 'redirected' && (
            <span className="shrink-0 px-1 py-0.5 rounded text-xs font-medium bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
              redirected
            </span>
          )}
        </div>
      </td>

      {/* Method */}
      <td className="px-2 py-1 whitespace-nowrap font-mono text-gray-600 dark:text-gray-400 text-right">
        {entry.method}
      </td>

      {/* Status */}
      <td className={`px-2 py-1 whitespace-nowrap font-mono text-right ${statusColor(entry.statusCode)}`}>
        {entry.statusCode ?? '—'}
      </td>

      {/* Type */}
      <td className="px-2 py-1 whitespace-nowrap text-gray-500 dark:text-gray-400 text-right">
        {entry.resourceType}
      </td>

      {/* Size */}
      <td className={`px-2 py-1 whitespace-nowrap text-right ${entry.fromCache ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
        {formatSize(entry.transferSize)}
      </td>

      {/* Time */}
      <td className="px-2 py-1 whitespace-nowrap text-gray-500 dark:text-gray-400 text-right pr-3">
        {formatTime(entry.duration)}
      </td>
    </tr>
  )
}
