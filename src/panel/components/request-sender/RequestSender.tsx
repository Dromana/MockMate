import { useEffect, useState } from 'react'
import { useRequestSenderStore } from '@/panel/store/request-sender-store'
import { KeyValueEditor } from './KeyValueEditor'
import { BodyEditor } from './BodyEditor'
import { ResponsePane } from './ResponsePane'
import { SavedRequestList } from './SavedRequestList'
import { HTTP_METHODS, isBrowserControlledHeader } from '@/constants'

type RequestTab = 'Headers' | 'Params' | 'Body' | 'Response'

export function RequestSender() {
  const [requestTab, setRequestTab] = useState<RequestTab>('Headers')
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  const method = useRequestSenderStore((s) => s.method)
  const url = useRequestSenderStore((s) => s.url)
  const headers = useRequestSenderStore((s) => s.headers)
  const params = useRequestSenderStore((s) => s.params)
  const body = useRequestSenderStore((s) => s.body)
  const bodyType = useRequestSenderStore((s) => s.bodyType)
  const response = useRequestSenderStore((s) => s.response)
  const activeSavedRequestId = useRequestSenderStore((s) => s.activeSavedRequestId)
  const savedRequests = useRequestSenderStore((s) => s.savedRequests)

  const setMethod = useRequestSenderStore((s) => s.setMethod)
  const setUrl = useRequestSenderStore((s) => s.setUrl)
  const setHeaders = useRequestSenderStore((s) => s.setHeaders)
  const setParams = useRequestSenderStore((s) => s.setParams)
  const setBody = useRequestSenderStore((s) => s.setBody)
  const setBodyType = useRequestSenderStore((s) => s.setBodyType)
  const sendRequest = useRequestSenderStore((s) => s.sendRequest)
  const saveCurrentRequest = useRequestSenderStore((s) => s.saveCurrentRequest)
  const loadFromStorage = useRequestSenderStore((s) => s.loadFromStorage)

  useEffect(() => { loadFromStorage() }, [loadFromStorage])

  const hasResponse = response.status !== null || response.error !== null || response.loading

  useEffect(() => {
    if (hasResponse) setRequestTab('Response')
  }, [hasResponse])

  const handleSave = () => {
    const activeName = activeSavedRequestId
      ? savedRequests.find((r) => r.id === activeSavedRequestId)?.name ?? ''
      : ''
    setSaveName(activeName || defaultName())
    setSaveDialogOpen(true)
  }

  const handleSaveConfirm = () => {
    if (!saveName.trim()) return
    saveCurrentRequest(saveName.trim())
    setSaveDialogOpen(false)
  }

  function defaultName(): string {
    if (!url) return 'New Request'
    try { return `${method} ${new URL(url).pathname}` } catch { return `${method} ${url}` }
  }

  const enabledParamCount = params.filter((p) => p.enabled && p.key).length
  const enabledHeaderCount = headers.filter((h) => h.enabled && h.key).length

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-44 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex flex-col overflow-hidden">
        <SavedRequestList />
      </div>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Request bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 rounded px-1.5 py-1 text-xs font-mono font-semibold bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shrink-0"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendRequest() }}
            placeholder="https://api.example.com/endpoint"
            className="flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />

          <button
            onClick={handleSave}
            className="shrink-0 px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer"
          >
            Save
          </button>

          <button
            onClick={sendRequest}
            disabled={!url.trim() || response.loading}
            className="shrink-0 px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            Send
          </button>
        </div>

        {/* Request + Response tabs */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 dark:border-gray-700 shrink-0">
            {(['Headers', 'Params', 'Body', 'Response'] as RequestTab[]).map((tab) => {
              const count = tab === 'Headers' ? enabledHeaderCount : tab === 'Params' ? enabledParamCount : 0
              const showStatus = tab === 'Response' && response.status !== null
              return (
                <button
                  key={tab}
                  onClick={() => setRequestTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium cursor-pointer ${
                    requestTab === tab
                      ? 'border-b-2 border-blue-600 text-blue-700'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tab}
                  {count > 0 && (
                    <span className="ml-1 text-gray-400 dark:text-gray-500">({count})</span>
                  )}
                  {showStatus && (
                    <span className={`ml-1.5 text-xs font-semibold ${response.status! < 300 ? 'text-green-500' : response.status! < 400 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {response.status}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {requestTab === 'Headers' && (
              <div className="h-full overflow-auto p-3">
                <KeyValueEditor
                  pairs={headers}
                  onChange={setHeaders}
                  keyPlaceholder="Header name"
                  valuePlaceholder="Value"
                  isBrowserControlled={isBrowserControlledHeader}
                />
              </div>
            )}
            {requestTab === 'Params' && (
              <div className="h-full overflow-auto p-3">
                <KeyValueEditor
                  pairs={params}
                  onChange={setParams}
                  keyPlaceholder="Parameter name"
                  valuePlaceholder="Value"
                />
              </div>
            )}
            {requestTab === 'Body' && (
              <div className="h-full overflow-auto p-3">
                <BodyEditor
                  body={body}
                  bodyType={bodyType}
                  onBodyChange={setBody}
                  onBodyTypeChange={setBodyType}
                />
              </div>
            )}
            {requestTab === 'Response' && (
              <div className="h-full overflow-hidden">
                <ResponsePane
                  status={response.status}
                  statusText={response.statusText}
                  headers={response.headers}
                  body={response.body}
                  duration={response.duration}
                  error={response.error}
                  loading={response.loading}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save dialog */}
      {saveDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-72 flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Save Request</p>
            <input
              autoFocus
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveConfirm(); if (e.key === 'Escape') setSaveDialogOpen(false) }}
              placeholder="Request name…"
              className="border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSaveDialogOpen(false)}
                className="px-3 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfirm}
                disabled={!saveName.trim()}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
