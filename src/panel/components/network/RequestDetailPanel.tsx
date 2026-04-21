import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { BodyType } from '@/types'
import { prettyPrint, detectFormat } from '@/shared/pretty-print'

function detectBodyType(headers: Record<string, string> | null): BodyType {
  const ct = headers?.['content-type'] ?? ''
  if (ct.includes('application/json')) return 'json'
  if (ct.includes('text/html')) return 'html'
  return 'text'
}
import { RequestLogEntry } from '@/types'
import { useUIStore } from '@/panel/store/ui-store'

interface RequestDetailPanelProps {
  entry: RequestLogEntry
}

type DetailTab = 'General' | 'Headers' | 'Payload' | 'Response' | 'HAR'

function HeaderTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers)
  if (entries.length === 0) return <p className="text-xs text-gray-400 dark:text-gray-500 italic">No headers</p>
  return (
    <div className="font-mono text-xs flex flex-col gap-0.5">
      {entries.map(([name, value]) => (
        <div key={name} className="flex gap-2 min-w-0">
          <span className="text-gray-500 dark:text-gray-400 shrink-0">{name}:</span>
          <span className="text-gray-800 dark:text-gray-200 break-all">{value}</span>
        </div>
      ))}
    </div>
  )
}

function GeneralTab({ entry }: { entry: RequestLogEntry }) {
  const rows = [
    ['Request URL', entry.url],
    ['Request Method', entry.method],
    ['Status Code', entry.statusCode !== null ? String(entry.statusCode) : 'pending…'],
    ['Intercepted',
      entry.status === 'mocked'
        ? `Yes (response) — ${entry.matchedRuleName ?? ''}`
        : entry.status === 'payload-mocked'
        ? `Yes (request) — ${entry.matchedRuleName ?? ''}`
        : 'No (passed through)',
    ],
  ]
  return (
    <div className="flex flex-col gap-1 font-mono text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-2">
          <span className="text-gray-500 dark:text-gray-400 shrink-0 w-32">{label}:</span>
          <span className="text-gray-800 dark:text-gray-200 break-all">{value}</span>
        </div>
      ))}
    </div>
  )
}

// For request headers: Chrome HAR captures headers AFTER CDP has already applied
// Fetch.continueRequest modifications. Reverse-apply set mods to reconstruct the
// original "before" state so the diff shows what was actually injected.
function computeBeforeRequestHeaders(
  effectiveHeaders: Record<string, string>,
  mods: Array<{ operation: 'set' | 'remove'; name: string; value: string }>,
): Record<string, string> {
  const before = { ...effectiveHeaders }
  for (const mod of mods) {
    if (mod.operation === 'set') {
      const lower = mod.name.toLowerCase()
      for (const key of Object.keys(before)) {
        if (key.toLowerCase() === lower) delete before[key]
      }
    }
    // 'remove': original value is unknown since the header is gone from HAR — skip
  }
  return before
}

// Applies header modifications to a headers record and returns a new record.
function applyMods(
  headers: Record<string, string>,
  mods: Array<{ operation: 'set' | 'remove'; name: string; value: string }>,
): Record<string, string> {
  const result = { ...headers }
  for (const mod of mods) {
    if (mod.operation === 'set') {
      result[mod.name] = mod.value
    } else {
      const lower = mod.name.toLowerCase()
      for (const key of Object.keys(result)) {
        if (key.toLowerCase() === lower) delete result[key]
      }
    }
  }
  return result
}

function HeadersTab({ entry }: { entry: RequestLogEntry }) {
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setSearchQuery('') }, [entry.id])

  const responseHeaders = entry.responseHeaders ?? entry.mockResponseHeaders ?? null
  const mods = entry.appliedHeaderMods

  // For payload-mocked entries, build a synthetic mods list from the injected headers
  const mockRequestHeaderMods: Array<{ operation: 'set' | 'remove'; name: string; value: string }> | null =
    entry.status === 'payload-mocked' && entry.mockRequestAdditionalHeaders
      ? Object.entries(entry.mockRequestAdditionalHeaders).map(([name, value]) => ({ operation: 'set' as const, name, value }))
      : null

  const filterHeaders = (headers: Record<string, string>) => {
    if (!searchQuery) return Object.entries(headers)
    const q = searchQuery.toLowerCase()
    return Object.entries(headers).filter(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q))
  }

  const highlight = (text: string) => {
    if (!searchQuery) return <>{text}</>
    const q = searchQuery.toLowerCase()
    const idx = text.toLowerCase().indexOf(q)
    if (idx === -1) return <>{text}</>
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 dark:bg-yellow-700 text-gray-900 dark:text-gray-100 rounded-sm">{text.slice(idx, idx + searchQuery.length)}</mark>
        {text.slice(idx + searchQuery.length)}
      </>
    )
  }

  // Plain header table (no diffs)
  const FilteredHeaderTable = ({ headers }: { headers: Record<string, string> }) => {
    const rows = filterHeaders(headers)
    if (rows.length === 0) return <p className="text-xs text-gray-400 dark:text-gray-500 italic">No matching headers</p>
    return (
      <div className="font-mono text-xs flex flex-col gap-0.5">
        {rows.map(([name, value]) => (
          <div key={name} className="flex gap-2 min-w-0">
            <span className="text-gray-500 dark:text-gray-400 shrink-0">{highlight(name)}:</span>
            <span className="text-gray-800 dark:text-gray-200 break-all">{highlight(value)}</span>
          </div>
        ))}
      </div>
    )
  }

  // Diff header table — shows original vs effective (after mods)
  const DiffHeaderTable = ({
    headers,
    headerMods,
  }: {
    headers: Record<string, string>
    headerMods: Array<{ operation: 'set' | 'remove'; name: string; value: string }>
  }) => {
    if (headerMods.length === 0) return <FilteredHeaderTable headers={headers} />

    const effective = applyMods(headers, headerMods)

    // Build a set of all header names (original + added)
    const allNames = Array.from(new Set([
      ...Object.keys(headers),
      ...headerMods.filter((m) => m.operation === 'set').map((m) => m.name),
    ]))

    const rows = allNames.filter((name) => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      const orig = headers[name] ?? ''
      const eff = effective[name] ?? ''
      return name.toLowerCase().includes(q) || orig.toLowerCase().includes(q) || eff.toLowerCase().includes(q)
    })

    if (rows.length === 0) return <p className="text-xs text-gray-400 dark:text-gray-500 italic">No matching headers</p>

    return (
      <div className="font-mono text-xs flex flex-col gap-0.5">
        {rows.map((name) => {
          const origValue = headers[name]
          const effValue = effective[name]
          const changed = origValue !== effValue

          if (!changed) {
            return (
              <div key={name} className="flex gap-2 min-w-0">
                <span className="text-gray-500 dark:text-gray-400 shrink-0">{highlight(name)}:</span>
                <span className="text-gray-800 dark:text-gray-200 break-all">{highlight(origValue ?? '')}</span>
              </div>
            )
          }

          // Removed header
          if (effValue === undefined) {
            return (
              <div key={name} className="flex gap-2 min-w-0 bg-red-50 dark:bg-red-900/20 rounded px-1">
                <span className="text-gray-500 dark:text-gray-400 shrink-0 line-through">{name}:</span>
                <span className="text-red-500 dark:text-red-400 break-all line-through">{origValue}</span>
                <span className="ml-1 text-red-400 dark:text-red-500 text-xs italic shrink-0">removed</span>
              </div>
            )
          }

          // Added header (new)
          if (origValue === undefined) {
            return (
              <div key={name} className="flex gap-2 min-w-0 bg-teal-50 dark:bg-teal-900/20 rounded px-1">
                <span className="text-gray-500 dark:text-gray-400 shrink-0">{name}:</span>
                <span className="text-teal-700 dark:text-teal-300 break-all font-medium">{effValue}</span>
                <span className="ml-1 text-teal-500 dark:text-teal-400 text-xs italic shrink-0">added</span>
              </div>
            )
          }

          // Modified header — show original → new
          return (
            <div key={name} className="flex flex-col gap-0.5 bg-teal-50 dark:bg-teal-900/20 rounded px-1 py-0.5">
              <div className="flex gap-2 min-w-0">
                <span className="text-gray-500 dark:text-gray-400 shrink-0">{name}:</span>
                <span className="text-gray-400 dark:text-gray-500 break-all line-through">{origValue}</span>
                <span className="ml-1 text-teal-500 dark:text-teal-400 text-xs italic shrink-0">overridden</span>
              </div>
              <div className="flex gap-2 min-w-0 pl-2">
                <span className="text-teal-400 dark:text-teal-500 shrink-0">→</span>
                <span className="text-teal-700 dark:text-teal-300 break-all font-medium">{effValue}</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const reqCount = filterHeaders(entry.requestHeaders).length
  const resCount = responseHeaders ? filterHeaders(responseHeaders).length : 0
  const totalMatches = reqCount + resCount

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded overflow-hidden self-start">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); searchInputRef.current?.blur() } }}
          placeholder="Filter headers…"
          className="px-2 py-0.5 text-xs w-36 focus:outline-none focus:w-52 transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        />
        {searchQuery && (
          <>
            <span className="text-xs text-gray-400 dark:text-gray-500 px-1 border-l border-gray-200 dark:border-gray-700 whitespace-nowrap">
              {totalMatches} match{totalMatches !== 1 ? 'es' : ''}
            </span>
            <button
              onClick={() => setSearchQuery('')}
              className="px-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-400 dark:text-gray-500 border-l border-gray-200 dark:border-gray-700"
              title="Clear"
            >×</button>
          </>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Request Headers</p>
        {mods && mods.requestHeaders.length > 0
          ? <DiffHeaderTable headers={computeBeforeRequestHeaders(entry.requestHeaders, mods.requestHeaders)} headerMods={mods.requestHeaders} />
          : mockRequestHeaderMods && mockRequestHeaderMods.length > 0
          ? <DiffHeaderTable headers={computeBeforeRequestHeaders(entry.requestHeaders, mockRequestHeaderMods)} headerMods={mockRequestHeaderMods} />
          : <FilteredHeaderTable headers={entry.requestHeaders} />
        }
      </div>
      {responseHeaders && (
        <div>
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Response Headers</p>
          {mods && mods.responseHeaders.length > 0
            ? <DiffHeaderTable headers={responseHeaders} headerMods={mods.responseHeaders} />
            : <FilteredHeaderTable headers={responseHeaders} />
          }
        </div>
      )}
    </div>
  )
}

// Chrome HAR captures the original URL (pre-CDP), so originalParams are the true
// "before" state. Apply mods forward to compute what the server actually received.
function QueryParamDiffTable({
  originalParams,
  mods,
}: {
  originalParams: [string, string][]
  mods: Array<{ operation: 'set' | 'remove'; name: string; value: string }>
}) {
  const beforeMap = new Map(originalParams)

  // Apply mods forward to compute effective (server-received) params
  const afterMap = new Map(originalParams)
  for (const mod of mods) {
    if (mod.operation === 'set') afterMap.set(mod.name, mod.value)
    else afterMap.delete(mod.name)
  }

  // All param names: original params + any newly added by set mods
  const allNames = Array.from(new Set([
    ...Array.from(beforeMap.keys()),
    ...mods.filter((m) => m.operation === 'set').map((m) => m.name),
  ]))

  return (
    <div className="font-mono text-xs flex flex-col gap-0.5">
      {allNames.map((name) => {
        const origValue = beforeMap.get(name)
        const effValue = afterMap.get(name)
        const changed = origValue !== effValue

        if (!changed) {
          return (
            <div key={name} className="flex gap-2 min-w-0">
              <span className="text-gray-500 dark:text-gray-400 shrink-0">{name}:</span>
              <span className="text-gray-800 dark:text-gray-200 break-all">{origValue}</span>
            </div>
          )
        }

        // Removed
        if (effValue === undefined) {
          return (
            <div key={name} className="flex gap-2 min-w-0 bg-red-50 dark:bg-red-900/20 rounded px-1">
              <span className="text-gray-500 dark:text-gray-400 shrink-0 line-through">{name}:</span>
              <span className="text-red-500 dark:text-red-400 break-all line-through">{origValue}</span>
              <span className="ml-1 text-red-400 dark:text-red-500 text-xs italic shrink-0">removed</span>
            </div>
          )
        }

        // Added (new param)
        if (origValue === undefined) {
          return (
            <div key={name} className="flex gap-2 min-w-0 bg-cyan-50 dark:bg-cyan-900/20 rounded px-1">
              <span className="text-gray-500 dark:text-gray-400 shrink-0">{name}:</span>
              <span className="text-cyan-700 dark:text-cyan-300 break-all font-medium">{effValue}</span>
              <span className="ml-1 text-cyan-500 dark:text-cyan-400 text-xs italic shrink-0">added</span>
            </div>
          )
        }

        // Overridden (existing param, new value)
        return (
          <div key={name} className="flex flex-col gap-0.5 bg-cyan-50 dark:bg-cyan-900/20 rounded px-1 py-0.5">
            <div className="flex gap-2 min-w-0">
              <span className="text-gray-500 dark:text-gray-400 shrink-0">{name}:</span>
              <span className="text-gray-400 dark:text-gray-500 break-all line-through">{origValue}</span>
              <span className="ml-1 text-cyan-500 dark:text-cyan-400 text-xs italic shrink-0">overridden</span>
            </div>
            <div className="flex gap-2 min-w-0 pl-2">
              <span className="text-cyan-400 dark:text-cyan-500 shrink-0">→</span>
              <span className="text-cyan-700 dark:text-cyan-300 break-all font-medium">{effValue}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PayloadTab({ entry }: { entry: RequestLogEntry }) {
  const { openEditor } = useUIStore()
  const [editMode, setEditMode] = useState(false)
  const [editedBody, setEditedBody] = useState(entry.requestBody ?? '')
  const [bodyPretty, setBodyPretty] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMatch, setActiveMatch] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const matchRefs = useRef<(HTMLElement | null)[]>([])

  const urlPattern = useMemo(() => {
    try { const u = new URL(entry.url); return `${u.origin}${u.pathname}*` } catch { return entry.url }
  }, [entry.url])

  const gqlName = entry.graphqlOperationName ?? undefined

  const defaultRuleName = useMemo(() => gqlName
    ? `Mock ${gqlName}`
    : (() => { try { return `Mock ${entry.method} ${new URL(entry.url).pathname}` } catch { return `Mock ${entry.method}` } })()
  , [gqlName, entry.method, entry.url])

  // Keep editedBody in sync when entry changes
  useEffect(() => {
    if (!editMode) setEditedBody(entry.requestBody ?? '')
  }, [entry.requestBody, editMode])

  const handleEditPayload = () => {
    if (entry.status === 'payload-mocked') {
      // Open modal directly pre-filled with the existing mock rule data
      openEditor(null, {
        name: entry.matchedRuleName ?? defaultRuleName,
        urlPattern,
        urlPatternType: 'glob',
        methods: [entry.method],
        action: 'mock_request',
        requestBody: entry.mockRequestBody ?? entry.requestBody ?? undefined,
        requestHeaders: entry.mockRequestAdditionalHeaders ?? undefined,
        graphqlOperationName: gqlName,
      })
    } else {
      setEditMode(true)
    }
  }

  const handleCreateRuleFromEdit = () => {
    openEditor(null, {
      name: defaultRuleName,
      urlPattern,
      urlPatternType: 'glob',
      methods: [entry.method],
      action: 'mock_request',
      requestBody: editedBody || undefined,
      graphqlOperationName: gqlName,
    })
    setEditMode(false)
  }

  // Query parameters
  let queryParams: [string, string][] = []
  try {
    queryParams = [...new URL(entry.url).searchParams.entries()]
  } catch { /* ignore */ }

  const body = entry.requestBody

  const bodyFormat = useMemo(() => {
    if (entry.resourceType === 'graphql') return 'graphql'
    const ct = entry.requestHeaders['content-type'] ?? ''
    if (ct.includes('json')) return 'json'
    if (ct.includes('html')) return 'html'
    return 'unknown'
  }, [entry.requestHeaders, entry.resourceType])

  const displayBody = useMemo(() => {
    if (!body || !bodyPretty) return body
    try { return prettyPrint(body, bodyFormat) } catch { return body }
  }, [body, bodyPretty, bodyFormat])

  const matchCount = searchQuery
    ? (displayBody ?? '').toLowerCase().split(searchQuery.toLowerCase()).length - 1
    : 0

  useEffect(() => {
    setActiveMatch(0)
    matchRefs.current = []
  }, [searchQuery, displayBody])

  useEffect(() => {
    matchRefs.current[activeMatch]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeMatch])

  // Reset on entry change
  useEffect(() => { setBodyPretty(false); setSearchQuery(''); setEditMode(false) }, [entry.id])

  const goNext = useCallback(() => { if (matchCount > 0) setActiveMatch((i) => (i + 1) % matchCount) }, [matchCount])
  const goPrev = useCallback(() => { if (matchCount > 0) setActiveMatch((i) => (i - 1 + matchCount) % matchCount) }, [matchCount])

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.shiftKey ? goPrev() : goNext() }
    if (e.key === 'Escape') { setSearchQuery(''); searchInputRef.current?.blur() }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Query Parameters */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Query Parameters</span>
          {queryParams.length > 0 && (
            <button
              onClick={() => openEditor(null, {
                name: defaultRuleName,
                urlPattern,
                urlPatternType: 'glob',
                methods: [entry.method],
                action: 'modify_query_params',
                graphqlOperationName: gqlName,
                queryParams,
              })}
              className="flex items-center gap-1 px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300 ml-auto"
            >
              <span>✏</span> Edit
            </button>
          )}
        </div>
        {queryParams.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">No query parameter was sent</p>
        ) : entry.appliedQueryParamMods && entry.appliedQueryParamMods.length > 0 ? (
          <QueryParamDiffTable originalParams={queryParams} mods={entry.appliedQueryParamMods} />
        ) : (
          <div className="font-mono text-xs flex flex-col gap-0.5">
            {queryParams.map(([k, v]) => (
              <div key={k} className="flex gap-2 min-w-0">
                <span className="text-gray-500 dark:text-gray-400 shrink-0">{k}:</span>
                <span className="text-gray-800 dark:text-gray-200 break-all">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Body */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Request Body</span>
          {!editMode && (
            <div className="flex items-center gap-1 ml-auto">
              {body && bodyFormat !== 'unknown' && (
                <button
                  onClick={() => setBodyPretty((p) => !p)}
                  className={`px-2 py-0.5 rounded text-xs font-mono cursor-pointer ${
                    bodyPretty
                      ? 'bg-gray-800 dark:bg-gray-700 text-gray-100'
                      : 'bg-gray-800/60 dark:bg-gray-700/60 text-gray-300 hover:bg-gray-800 dark:hover:bg-gray-700 hover:text-gray-100'
                  }`}
                >
                  {'{ }'} pretty
                </button>
              )}
              {body && (
                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Find…"
                    className="px-2 py-0.5 text-xs w-24 focus:outline-none focus:w-36 transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                  {searchQuery && (
                    <>
                      <span className="text-xs text-gray-400 dark:text-gray-500 px-1 border-l border-gray-200 dark:border-gray-700 whitespace-nowrap">
                        {matchCount === 0 ? '0/0' : `${activeMatch + 1}/${matchCount}`}
                      </span>
                      <button onClick={goPrev} className="px-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-600 dark:text-gray-400" title="Previous (Shift+Enter)">‹</button>
                      <button onClick={goNext} className="px-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-600 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700" title="Next (Enter)">›</button>
                      <button onClick={() => setSearchQuery('')} className="px-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-400 dark:text-gray-500 border-l border-gray-200 dark:border-gray-700" title="Clear">×</button>
                    </>
                  )}
                </div>
              )}
              <button
                onClick={handleEditPayload}
                className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300 shrink-0"
              >
                <span>✏</span> {entry.status === 'payload-mocked' ? 'Edit Rule' : 'Edit'}
              </button>
            </div>
          )}
        </div>

        {editMode ? (
          <div className="flex flex-col gap-2">
            <textarea
              className="border border-blue-400 rounded p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[160px]"
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              spellCheck={false}
              placeholder='{"key": "value"}'
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateRuleFromEdit}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 cursor-pointer"
              >
                Create Mock Rule
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : !body ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">No request body</p>
            <button
              onClick={() => setEditMode(true)}
              className="self-start px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 cursor-pointer"
            >
              Create mock for this request
            </button>
          </div>
        ) : (
          <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono overflow-auto whitespace-pre-wrap break-all max-h-64 text-gray-900 dark:text-gray-100">
            {searchQuery ? (
              <HighlightedBody
                text={displayBody ?? ''}
                query={searchQuery}
                activeIndex={activeMatch}
                matchRefs={matchRefs}
              />
            ) : (
              displayBody
            )}
          </pre>
        )}

        {/* Show mocked body override when payload-mocked */}
        {entry.status === 'payload-mocked' && entry.mockRequestBody && (
          <div className="flex flex-col gap-1 mt-2">
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">Mocked Body Override</span>
            <pre className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-2 text-xs font-mono overflow-auto whitespace-pre-wrap break-all max-h-48 text-gray-900 dark:text-gray-100">
              {entry.mockRequestBody}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// Splits `text` into segments, wrapping matches of `query` in highlight spans.
function HighlightedBody({
  text,
  query,
  activeIndex,
  matchRefs,
}: {
  text: string
  query: string
  activeIndex: number
  matchRefs: React.MutableRefObject<(HTMLElement | null)[]>
}) {
  if (!query) {
    return <>{text}</>
  }

  const parts: React.ReactNode[] = []
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  let cursor = 0
  let matchIdx = 0

  while (cursor < text.length) {
    const found = lowerText.indexOf(lowerQuery, cursor)
    if (found === -1) {
      parts.push(text.slice(cursor))
      break
    }
    if (found > cursor) parts.push(text.slice(cursor, found))
    const idx = matchIdx++
    parts.push(
      <mark
        key={idx}
        ref={(el) => { matchRefs.current[idx] = el }}
        className={idx === activeIndex ? 'bg-orange-400 text-white rounded-sm' : 'bg-yellow-200 text-gray-900 rounded-sm'}
      >
        {text.slice(found, found + query.length)}
      </mark>,
    )
    cursor = found + query.length
  }

  return <>{parts}</>
}

function ResponseTab({ entry }: { entry: RequestLogEntry }) {
  const { openEditor } = useUIStore()
  const [editMode, setEditMode] = useState(false)
  const [pretty, setPretty] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMatch, setActiveMatch] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const matchRefs = useRef<(HTMLElement | null)[]>([])

  // For mocked entries show the mock body; for passthrough show the real response body
  const body = entry.status === 'mocked' ? entry.mockResponseBody : entry.responseBody

  const format = useMemo(
    () => detectFormat(entry.resourceType, entry.responseHeaders?.['content-type'] ?? entry.mockResponseHeaders?.['content-type']),
    [entry.resourceType, entry.responseHeaders, entry.mockResponseHeaders],
  )

  const displayBody = useMemo(() => {
    if (!body || !pretty) return body
    const formatted = prettyPrint(body, format)
    return formatted
  }, [body, pretty, format])

  const [editedBody, setEditedBody] = useState(body ?? '')

  // Count matches against the currently displayed text (raw or pretty)
  const matchCount = searchQuery
    ? (displayBody ?? '').toLowerCase().split(searchQuery.toLowerCase()).length - 1
    : 0

  // Keep editedBody in sync with the loaded body (passthrough body arrives async)
  useEffect(() => {
    if (!editMode) setEditedBody(body ?? '')
  }, [body, editMode])

  // Reset pretty-print when the entry changes
  useEffect(() => { setPretty(false) }, [entry.id])

  // Clamp activeMatch when query or displayBody changes
  useEffect(() => {
    setActiveMatch(0)
    matchRefs.current = []
  }, [searchQuery, displayBody])

  // Scroll active match into view
  useEffect(() => {
    matchRefs.current[activeMatch]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeMatch])

  const goNext = useCallback(() => {
    if (matchCount === 0) return
    setActiveMatch((i) => (i + 1) % matchCount)
  }, [matchCount])

  const goPrev = useCallback(() => {
    if (matchCount === 0) return
    setActiveMatch((i) => (i - 1 + matchCount) % matchCount)
  }, [matchCount])

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.shiftKey ? goPrev() : goNext() }
    if (e.key === 'Escape') { setSearchQuery(''); searchInputRef.current?.blur() }
  }

  const detectedBodyType = useMemo(
    () => detectBodyType(entry.responseHeaders ?? entry.mockResponseHeaders),
    [entry.responseHeaders, entry.mockResponseHeaders],
  )

  const urlPattern = useMemo(() => {
    try { const u = new URL(entry.url); return `${u.origin}${u.pathname}*` } catch { return entry.url }
  }, [entry.url])

  // Headers that cause conditional re-validation or describe the transport encoding —
  // including them in a mock causes the browser to send If-None-Match / If-Modified-Since
  // on the next request, which can produce another 304 and bypass the mock.
  const STRIP_HEADERS = new Set([
    'etag', 'last-modified',
    'content-encoding', 'transfer-encoding', 'content-length',
  ])

  const originalHeaders = useMemo(() => {
    const raw = entry.responseHeaders ?? entry.mockResponseHeaders ?? {}
    return Object.fromEntries(
      Object.entries(raw).filter(([name]) => !STRIP_HEADERS.has(name.toLowerCase())),
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.responseHeaders, entry.mockResponseHeaders])

  const mockStatusCode = entry.statusCode ?? 200

  const gqlName = entry.graphqlOperationName ?? undefined

  const handleEditResponseBody = () => {
    if (entry.status === 'mocked' && entry.matchedRuleId) {
      openEditor(null, {
        name: entry.matchedRuleName ?? '',
        urlPattern,
        methods: [entry.method],
        statusCode: mockStatusCode,
        body: entry.mockResponseBody ?? '',
        bodyType: detectedBodyType,
        responseHeaders: originalHeaders,
        graphqlOperationName: gqlName,
      })
    } else {
      setEditMode(true)
    }
  }

  const handleCreateRuleFromEdit = () => {
    const defaultName = gqlName
      ? `Mock ${gqlName}`
      : (() => { try { return `Mock ${entry.method} ${new URL(entry.url).pathname}` } catch { return `Mock ${entry.method}` } })()
    openEditor(null, {
      name: defaultName,
      urlPattern,
      methods: [entry.method],
      statusCode: mockStatusCode,
      body: editedBody,
      bodyType: detectedBodyType,
      responseHeaders: originalHeaders,
      graphqlOperationName: gqlName,
      requestBody: entry.requestBody ?? undefined,
      requestHeaders: entry.requestHeaders ?? undefined,
    })
    setEditMode(false)
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide shrink-0">Response Body</span>
        {!editMode && body !== null && (
          <div className="flex items-center gap-1 ml-auto">
            {/* Pretty print toggle */}
            {format !== 'unknown' && (
              <button
                onClick={() => setPretty((p) => !p)}
                title={`Pretty print (${format.toUpperCase()})`}
                className={`px-2 py-0.5 rounded text-xs font-mono cursor-pointer ${
                  pretty
                    ? 'bg-gray-800 dark:bg-gray-700 text-gray-100'
                    : 'bg-gray-800/60 dark:bg-gray-700/60 text-gray-300 hover:bg-gray-800 dark:hover:bg-gray-700 hover:text-gray-100'
                }`}
              >
                {'{ }'} pretty
              </button>
            )}

            {/* Search box */}
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Find…"
                className="px-2 py-0.5 text-xs w-32 focus:outline-none focus:w-48 transition-all bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
              {searchQuery && (
                <>
                  <span className="text-xs text-gray-400 dark:text-gray-500 px-1 border-l border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    {matchCount === 0 ? '0/0' : `${activeMatch + 1}/${matchCount}`}
                  </span>
                  <button onClick={goPrev} className="px-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-600 dark:text-gray-400" title="Previous (Shift+Enter)">‹</button>
                  <button onClick={goNext} className="px-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-600 dark:text-gray-400 border-l border-gray-200 dark:border-gray-700" title="Next (Enter)">›</button>
                  <button onClick={() => setSearchQuery('')} className="px-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-400 dark:text-gray-500 border-l border-gray-200 dark:border-gray-700" title="Clear">×</button>
                </>
              )}
            </div>
            <button
              onClick={handleEditResponseBody}
              className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300 shrink-0"
            >
              <span>✏</span> Edit
            </button>
          </div>
        )}
        {!editMode && body === null && (
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={handleEditResponseBody}
              className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300"
            >
              <span>✏</span> Edit Response Body
            </button>
          </div>
        )}
      </div>

      {editMode ? (
        <div className="flex flex-col gap-2 flex-1">
          <textarea
            className="flex-1 border border-blue-400 rounded p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[160px]"
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            spellCheck={false}
            placeholder='{"key": "value"}'
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateRuleFromEdit}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 cursor-pointer"
            >
              Create Mock Rule
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : displayBody !== null ? (
        <pre className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono overflow-auto whitespace-pre-wrap break-all min-h-[120px] text-gray-900 dark:text-gray-100">
          <HighlightedBody
            text={displayBody}
            query={searchQuery}
            activeIndex={activeMatch}
            matchRefs={matchRefs}
          />
        </pre>
      ) : entry.responseBody === null && (entry.status === 'passthrough' || entry.status === 'payload-mocked') ? (
        /* Loading skeleton */
        <div className="flex flex-col gap-2 flex-1">
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <svg className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Loading response body…
            </div>
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="h-2.5 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-3/4" />
              <div className="h-2.5 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-full" />
              <div className="h-2.5 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-5/6" />
              <div className="h-2.5 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-2/3" />
              <div className="h-2.5 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-full" />
              <div className="h-2.5 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-4/5" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">No response body.</p>
          <button
            onClick={() => setEditMode(true)}
            className="self-start px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 cursor-pointer"
          >
            Create mock for this request
          </button>
        </div>
      )}
    </div>
  )
}

function HARTab({ entry }: { entry: RequestLogEntry }) {
  const har = {
    log: {
      version: '1.2',
      entries: [{
        startedDateTime: new Date(entry.timestamp).toISOString(),
        request: { method: entry.method, url: entry.url, headers: Object.entries(entry.requestHeaders).map(([name, value]) => ({ name, value })) },
        response: { status: entry.statusCode ?? 0, headers: Object.entries(entry.responseHeaders ?? entry.mockResponseHeaders ?? {}).map(([name, value]) => ({ name, value })), content: { text: entry.mockResponseBody ?? '' } },
        _mockmate: { status: entry.status, matchedRule: entry.matchedRuleName },
      }],
    },
  }
  return (
    <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 overflow-auto whitespace-pre-wrap text-gray-900 dark:text-gray-100">
      {JSON.stringify(har, null, 2)}
    </pre>
  )
}

const TABS: DetailTab[] = ['General', 'Headers', 'Payload', 'Response', 'HAR']

export function RequestDetailPanel({ entry }: RequestDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('Response')
  const { openEditor } = useUIStore()

  const gqlName = entry.graphqlOperationName ?? undefined
  const urlPattern = useMemo(() => {
    try { const u = new URL(entry.url); return `${u.origin}${u.pathname}*` } catch { return entry.url }
  }, [entry.url])

  const handleCreateMockRequest = () => {
    const defaultName = gqlName
      ? `Mock ${gqlName}`
      : (() => { try { return `Mock ${entry.method} ${new URL(entry.url).pathname}` } catch { return `Mock ${entry.method}` } })()
    openEditor(null, {
      name: defaultName,
      urlPattern,
      urlPatternType: 'glob',
      methods: [entry.method],
      action: 'mock_request',
      requestBody: entry.requestBody ?? undefined,
      requestHeaders: entry.requestHeaders ?? undefined,
      graphqlOperationName: gqlName,
    })
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      {/* Tab bar */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-medium cursor-pointer ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-700'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {entry.status !== 'payload-mocked' && (
          <button
            onClick={handleCreateMockRequest}
            className="ml-auto mr-2 flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-gray-700 dark:text-gray-300 shrink-0"
          >
            Mock Request
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'General' && <GeneralTab entry={entry} />}
        {activeTab === 'Headers' && <HeadersTab entry={entry} />}
        {activeTab === 'Payload' && <PayloadTab entry={entry} />}
        {activeTab === 'Response' && <ResponseTab entry={entry} />}
        {activeTab === 'HAR' && <HARTab entry={entry} />}
      </div>
    </div>
  )
}
