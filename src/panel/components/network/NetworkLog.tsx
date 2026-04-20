import { useRef, useEffect, useState, useCallback } from 'react'
import { useLogStore, filterEntries, LogFilter } from '@/panel/store/log-store'
import { NetworkLogItem } from './NetworkLogItem'
import { RequestDetailPanel } from './RequestDetailPanel'

const FILTERS: LogFilter[] = ['All', 'GraphQL', 'Fetch/XHR', 'JS', 'CSS', 'Img', 'Doc', 'Other']

const DEFAULT_WIDTHS = { url: 400, method: 72, status: 62, type: 100, size: 72, time: 72 }
type ColKey = keyof typeof DEFAULT_WIDTHS

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-center group z-20"
    >
      <div className="w-px h-3/4 bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-500 group-active:bg-blue-600" />
    </div>
  )
}

function useColumnResize() {
  const [widths, setWidths] = useState(DEFAULT_WIDTHS)
  // Keep a ref so drag handlers always read the latest value without stale closure
  const widthsRef = useRef(widths)
  widthsRef.current = widths

  const startResize = useCallback((col: ColKey, e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = widthsRef.current[col]

    const onMove = (ev: MouseEvent) => {
      const next = Math.max(40, startW + ev.clientX - startX)
      setWidths((prev) => ({ ...prev, [col]: next }))
    }
    const onUp = () => {
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  return { widths, startResize }
}

export function NetworkLog() {
  const { entries, preserveLog, filter, selectedEntryId, clearLog, setPreserveLog, setFilter, selectEntry } =
    useLogStore()
  const [urlFilter, setUrlFilter] = useState('')
  const { widths, startResize } = useColumnResize()
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const typeFiltered = filterEntries(entries, filter)
  const filtered = urlFilter
    ? typeFiltered.filter((e) => e.url.toLowerCase().includes(urlFilter.toLowerCase()))
    : typeFiltered
  const selectedEntry = entries.find((e) => e.id === selectedEntryId) ?? null

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (isAtBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Main area */}
      <div className={`flex flex-col min-h-0 ${selectedEntry ? 'w-1/2' : 'w-full'}`}>

        {/* Toolbar row 1 */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
          <button
            onClick={clearLog}
            className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M5 5l6 6M11 5l-6 6" />
            </svg>
            Clear logs
          </button>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={preserveLog}
              onChange={(e) => setPreserveLog(e.target.checked)}
              className="w-3 h-3"
            />
            Preserve log
          </label>
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{entries.length} requests</span>
        </div>

        {/* Toolbar row 2: url filter + type filters */}
        <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
          <div className="relative shrink-0">
            <input
              type="text"
              value={urlFilter}
              onChange={(e) => setUrlFilter(e.target.value)}
              placeholder="Filter"
              className="w-36 border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:w-52 transition-all pr-5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            {urlFilter && (
              <button
                onClick={() => setUrlFilter('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-sm leading-none"
              >
                ×
              </button>
            )}
          </div>
          <span className="w-px h-4 bg-gray-200 dark:bg-gray-700 shrink-0" />
          <div className="flex items-center gap-0.5 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded text-xs whitespace-nowrap cursor-pointer ${
                  filter === f ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Request list */}
        <div ref={listRef} className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-10">
              {entries.length === 0 ? 'Waiting for requests…' : 'No requests match this filter'}
            </p>
          ) : (
            <table className="table-fixed" style={{ minWidth: '100%', width: Object.values(widths).reduce((a, b) => a + b, 0) }}>
              <colgroup>
                <col style={{ width: widths.url }} />
                <col style={{ width: widths.method }} />
                <col style={{ width: widths.status }} />
                <col style={{ width: widths.type }} />
                <col style={{ width: widths.size }} />
                <col style={{ width: widths.time }} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {(
                    [
                      { key: 'url',    label: 'URL',    align: 'left'  },
                      { key: 'method', label: 'Method', align: 'right' },
                      { key: 'status', label: 'Status', align: 'right' },
                      { key: 'type',   label: 'Type',   align: 'right' },
                      { key: 'size',   label: 'Size',   align: 'right' },
                      { key: 'time',   label: 'Time',   align: 'right' },
                    ] as { key: ColKey; label: string; align: 'left' | 'right' }[]
                  ).map(({ key, label, align }) => (
                    <th
                      key={key}
                      className={`relative py-1 select-none overflow-hidden ${align === 'left' ? 'pl-3 pr-4 text-left' : 'px-2 text-right'}`}
                    >
                      {label}
                      <ResizeHandle onMouseDown={(e) => startResize(key, e)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <NetworkLogItem
                    key={entry.id}
                    entry={entry}
                    isSelected={entry.id === selectedEntryId}
                    onClick={() => selectEntry(entry.id === selectedEntryId ? null : entry.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Detail panel */}
      {selectedEntry && (
        <div className="w-1/2 flex flex-col min-h-0 border-l border-gray-200 dark:border-gray-700">
          <div className="flex items-center px-2 py-1 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
            <button
              onClick={() => selectEntry(null)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-base leading-none cursor-pointer mr-2"
            >
              ×
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={selectedEntry.url}>
              {selectedEntry.url}
            </span>
            {selectedEntry.status === 'mocked' && (
              <span className="ml-2 shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                Mocked
              </span>
            )}
            {selectedEntry.status === 'payload-mocked' && (
              <span className="ml-2 shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                Req Mocked
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <RequestDetailPanel entry={selectedEntry} />
          </div>
        </div>
      )}
    </div>
  )
}
