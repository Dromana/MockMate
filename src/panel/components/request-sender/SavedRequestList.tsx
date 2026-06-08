import { useState } from 'react'
import { useRequestSenderStore } from '@/panel/store/request-sender-store'
import { METHOD_COLORS } from '@/constants'

export function SavedRequestList() {
  const savedRequests = useRequestSenderStore((s) => s.savedRequests)
  const activeSavedRequestId = useRequestSenderStore((s) => s.activeSavedRequestId)
  const loadSavedRequest = useRequestSenderStore((s) => s.loadSavedRequest)
  const deleteSavedRequest = useRequestSenderStore((s) => s.deleteSavedRequest)
  const newRequest = useRequestSenderStore((s) => s.newRequest)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button
          onClick={newRequest}
          className="w-full text-left px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded cursor-pointer transition-colors"
        >
          + New Request
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {savedRequests.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400 dark:text-gray-500 italic text-center">
            No saved requests yet
          </p>
        ) : (
          savedRequests.map((req) => (
            <div
              key={req.id}
              onMouseEnter={() => setHoveredId(req.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors ${
                activeSavedRequestId === req.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-600'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => loadSavedRequest(req.id)}
            >
              <span className={`shrink-0 text-[10px] font-bold px-1 rounded ${METHOD_COLORS[req.method] ?? 'bg-gray-100 text-gray-700'}`}>
                {req.method.length > 4 ? req.method.slice(0, 3) : req.method}
              </span>
              <span className="flex-1 min-w-0 text-xs text-gray-700 dark:text-gray-300 truncate" title={req.name}>
                {req.name}
              </span>
              {hoveredId === req.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSavedRequest(req.id) }}
                  className="shrink-0 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-red-500 cursor-pointer rounded"
                  title="Delete"
                >
                  ×
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
