import React, { useState, useMemo } from 'react'
import TerminalLogs from '../modules/TerminalLogs'
import { useRouteHistory } from '../../hooks'
import { getBaseUrl } from '../../utils'

interface RouteDetailViewProps {
  moduleName: string
  routeUrl: string
  routeMethod: string
  onBack: () => void
}

interface KVPair {
  key: string
  value: string
}

interface ExecutionRecord {
  id: string
  executedAt: Date
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  source: 'console' | 'live'
  response: {
    status?: number
    statusText?: string
    headers?: Record<string, string>
    data?: any
    error?: string
    duration: number
  }
}

// Extract :param and :param? names from a URL template
function extractRouteParams(url: string): string[] {
  const matches = url.match(/:([a-zA-Z_][a-zA-Z0-9_]*)(\?)?/g) ?? []
  return matches.map(m => m.replace(/^:/, '').replace(/\?$/, ''))
}

// Replace :param placeholders with values, then append query string
function buildUrl(template: string, params: KVPair[], query: KVPair[]): string {
  let url = template
  for (const { key, value } of params) {
    url = url.replace(new RegExp(`:${key}\\??`, 'g'), encodeURIComponent(value) || `:${key}`)
  }
  const qs = query
    .filter(({ key }) => key.trim() !== '')
    .map(({ key, value }) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return qs ? `${url}?${qs}` : url
}

const KVTable: React.FC<{
  label: string
  rows: KVPair[]
  onChange: (rows: KVPair[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  fixedKeys?: boolean
}> = ({ label, rows, onChange, keyPlaceholder = 'key', valuePlaceholder = 'value', fixedKeys = false }) => {
  const update = (index: number, field: 'key' | 'value', val: string) => {
    const next = rows.map((r, i) => i === index ? { ...r, [field]: val } : r)
    onChange(next)
  }
  const add = () => onChange([...rows, { key: '', value: '' }])
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index))

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {!fixedKeys && (
          <button
            type="button"
            onClick={add}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            + Add
          </button>
        )}
      </div>
      <div className="border border-gray-300 rounded-md divide-y divide-gray-200">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center">
            <input
              value={row.key}
              onChange={e => update(i, 'key', e.target.value)}
              readOnly={fixedKeys}
              placeholder={keyPlaceholder}
              className={`w-2/5 px-2 py-1.5 text-sm font-mono border-r border-gray-200 focus:outline-none focus:bg-blue-50 ${fixedKeys ? 'bg-gray-50 text-gray-500' : ''}`}
            />
            <input
              value={row.value}
              onChange={e => update(i, 'value', e.target.value)}
              placeholder={valuePlaceholder}
              className="flex-1 px-2 py-1.5 text-sm font-mono focus:outline-none focus:bg-blue-50"
            />
            {!fixedKeys && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="px-2 text-gray-300 hover:text-red-500 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400 italic">No entries</div>
        )}
      </div>
    </div>
  )
}

const ResponsePanel: React.FC<{ response: ExecutionRecord['response'] }> = ({ response }) => (
  <div className="border border-gray-300 rounded-md">
    {response.error ? (
      <div className="p-3 text-red-600 text-sm font-mono">Error: {response.error}</div>
    ) : (
      <>
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${
              (response.status ?? 0) >= 200 && (response.status ?? 0) < 300 ? 'bg-green-100 text-green-800' :
              (response.status ?? 0) >= 400 ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {response.status} {response.statusText}
            </span>
            <span className="text-sm text-gray-600">{response.duration}ms</span>
          </div>
        </div>
        {response.headers && Object.keys(response.headers).length > 0 && (
          <div className="p-3 border-b border-gray-200">
            <div className="text-xs font-medium text-gray-600 mb-2">Response Headers:</div>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
              {JSON.stringify(response.headers, null, 2)}
            </pre>
          </div>
        )}
        <div className="p-3">
          <div className="text-xs font-medium text-gray-600 mb-2">Response Body:</div>
          <pre className="text-sm bg-gray-50 p-3 rounded border overflow-x-auto max-h-64">
            {typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)}
          </pre>
        </div>
      </>
    )}
  </div>
)

const RouteDetailView: React.FC<RouteDetailViewProps> = ({ moduleName, routeUrl, routeMethod, onBack }) => {
  const [showEndpoints, setShowEndpoints] = useState(false)
  const [testMethod, setTestMethod] = useState(routeMethod)
  const [testBody, setTestBody] = useState('{}')
  const [testHeaders, setTestHeaders] = useState('{\n  "Content-Type": "application/json"\n}')
  const [testResponse, setTestResponse] = useState<ExecutionRecord['response'] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<ExecutionRecord[]>([])
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)

  // Route params (derived from URL template, fixed keys)
  const paramNames = useMemo(() => extractRouteParams(routeUrl), [routeUrl])
  const [routeParams, setRouteParams] = useState<KVPair[]>(() =>
    paramNames.map(key => ({ key, value: '' }))
  )
  // Query string params (user-managed)
  const [queryParams, setQueryParams] = useState<KVPair[]>([])

  const resolvedUrl = useMemo(
    () => buildUrl(routeUrl, routeParams, queryParams),
    [routeUrl, routeParams, queryParams]
  )

  // Real traffic against this route (any caller, not just this console),
  // captured server-side by dev-console-plugin's onResponse hook.
  const { data: liveHistoryData } = useRouteHistory(routeMethod, routeUrl)
  const liveHistory: ExecutionRecord[] = useMemo(
    () => (liveHistoryData?.history ?? []).map(entry => ({
      id: entry.id,
      executedAt: new Date(entry.timestamp),
      method: entry.method,
      url: entry.url,
      headers: entry.requestHeaders as Record<string, string>,
      body: entry.requestBody !== undefined ? JSON.stringify(entry.requestBody) : undefined,
      source: 'live' as const,
      response: {
        status: entry.statusCode,
        duration: entry.duration,
      },
    })),
    [liveHistoryData]
  )

  const combinedHistory = useMemo(
    () => [...history, ...liveHistory]
      .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
      .slice(0, 30),
    [history, liveHistory]
  )

  const handleTestRoute = async () => {
    setIsLoading(true)
    setTestResponse(null)

    let parsedHeaders: Record<string, string>
    try {
      parsedHeaders = JSON.parse(testHeaders)
    } catch {
      setTestResponse({ error: 'Invalid JSON in headers', duration: 0 })
      setIsLoading(false)
      return
    }

    const requestOptions: RequestInit = { method: testMethod, headers: parsedHeaders }
    if (testMethod !== 'GET' && testMethod !== 'HEAD') {
      requestOptions.body = testBody
    }

    const executedAt = new Date()
    const startTime = Date.now()

    try {
      const response = await fetch(`${getBaseUrl()}${resolvedUrl}`, requestOptions)
      const duration = Date.now() - startTime
      const contentType = response.headers.get('content-type')
      const data = contentType?.includes('application/json') ? await response.json() : await response.text()

      const result: ExecutionRecord['response'] = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        duration,
      }

      setTestResponse(result)
      setHistory(prev => [{
        id: executedAt.getTime().toString(),
        executedAt,
        method: testMethod,
        url: resolvedUrl,
        headers: parsedHeaders,
        body: testMethod !== 'GET' && testMethod !== 'HEAD' ? testBody : undefined,
        source: 'console' as const,
        response: result,
      }, ...prev].slice(0, 20))
    } catch (error) {
      const result: ExecutionRecord['response'] = {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        duration: Date.now() - startTime,
      }
      setTestResponse(result)
      setHistory(prev => [{
        id: executedAt.getTime().toString(),
        executedAt,
        method: testMethod,
        url: resolvedUrl,
        headers: parsedHeaders,
        body: testMethod !== 'GET' && testMethod !== 'HEAD' ? testBody : undefined,
        source: 'console' as const,
        response: result,
      }, ...prev].slice(0, 20))
    } finally {
      setIsLoading(false)
    }
  }

  const loadFromHistory = (record: ExecutionRecord) => {
    setTestMethod(record.method)
    setTestHeaders(JSON.stringify(record.headers, null, 2))
    if (record.body) setTestBody(record.body)
    // Restore query params from saved URL
    try {
      const urlObj = new URL(record.url, 'http://x')
      const qp: KVPair[] = []
      urlObj.searchParams.forEach((value, key) => qp.push({ key, value }))
      setQueryParams(qp)
    } catch { /* ignore */ }
  }

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-green-100 text-green-800'
      case 'POST': return 'bg-blue-100 text-blue-800'
      case 'PUT': return 'bg-orange-100 text-orange-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      case 'PATCH': return 'bg-purple-100 text-purple-800'
      case 'HEAD': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              ← Back to {moduleName}
            </button>
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium ${getMethodColor(routeMethod)}`}>
                  {routeMethod}
                </span>
                <h1 className="text-2xl font-semibold text-gray-900">{routeUrl}</h1>
              </div>
              <p className="text-gray-600">HTTP Endpoint in {moduleName} module</p>
            </div>
          </div>
        </div>
      </div>

      {/* Route Information (collapsible) */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div
          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200"
          onClick={() => setShowEndpoints(!showEndpoints)}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Route Information</h3>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${showEndpoints ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {showEndpoints && (
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Full URL</label>
                <code className="block text-sm font-mono bg-gray-50 p-3 rounded border">
                  {getBaseUrl()}{routeUrl}
                </code>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Method</label>
                <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium ${getMethodColor(routeMethod)}`}>
                  {routeMethod}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Module</label>
                <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">{moduleName}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Route Tester */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Test Route</h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
              <select
                value={testMethod}
                onChange={(e) => setTestMethod(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>

            {/* URL preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Request URL</label>
              <code className="block text-xs font-mono bg-gray-50 p-2 rounded border text-gray-700 break-all">
                {getBaseUrl()}{resolvedUrl}
              </code>
            </div>

            {/* Route params */}
            {paramNames.length > 0 && (
              <KVTable
                label="Path Parameters"
                rows={routeParams}
                onChange={setRouteParams}
                keyPlaceholder="param"
                valuePlaceholder="value"
                fixedKeys
              />
            )}

            {/* Query params */}
            <KVTable
              label="Query Parameters"
              rows={queryParams}
              onChange={setQueryParams}
              keyPlaceholder="param"
              valuePlaceholder="value"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Headers</label>
              <textarea
                value={testHeaders}
                onChange={(e) => setTestHeaders(e.target.value)}
                className="w-full h-24 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter headers JSON..."
              />
            </div>

            {testMethod !== 'GET' && testMethod !== 'HEAD' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Request Body</label>
                <textarea
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  className="w-full h-32 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter request body..."
                />
              </div>
            )}

            <button
              onClick={handleTestRoute}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Testing...' : 'Test Route'}
            </button>
          </div>

          {/* Response */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Response</label>
            {testResponse ? (
              <ResponsePanel response={testResponse} />
            ) : (
              <div className="border border-gray-300 rounded-md p-8 text-center text-gray-500">
                Click "Test Route" to see the response
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Execution History */}
      {combinedHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Execution History</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {combinedHistory.length} execution{combinedHistory.length !== 1 ? 's' : ''} (console + live traffic)
              </span>
              {history.length > 0 && (
                <button
                  onClick={() => setHistory([])}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear console entries
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {combinedHistory.map((record) => (
              <div key={record.id}>
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedHistoryId(expandedHistoryId === record.id ? null : record.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getMethodColor(record.method)}`}>
                      {record.method}
                    </span>
                    <span className="text-sm font-mono text-gray-700">{record.url}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      record.source === 'console' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {record.source === 'console' ? 'console' : 'live'}
                    </span>
                    {record.response.error ? (
                      <span className="text-xs text-red-600">Error</span>
                    ) : (
                      <span className={`text-xs font-medium ${
                        (record.response.status ?? 0) >= 200 && (record.response.status ?? 0) < 300 ? 'text-green-600' :
                        (record.response.status ?? 0) >= 400 ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {record.response.status}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{record.response.duration}ms</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {record.executedAt.toLocaleTimeString()}
                    </span>
                    {record.source === 'console' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); loadFromHistory(record) }}
                        className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-blue-100 hover:text-blue-700 transition-colors"
                      >
                        Replay
                      </button>
                    )}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${expandedHistoryId === record.id ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {expandedHistoryId === record.id && (
                  <div className="px-4 pb-4 space-y-3 bg-gray-50">
                    {record.body && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-1">Request Body:</div>
                        <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">{record.body}</pre>
                      </div>
                    )}
                    <ResponsePanel response={record.response} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route Logs */}
      <TerminalLogs
        moduleName={moduleName}
        title={`${routeMethod} ${routeUrl} Logs`}
      />
    </div>
  )
}

export default RouteDetailView
