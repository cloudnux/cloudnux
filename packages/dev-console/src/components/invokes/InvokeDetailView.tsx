import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useInvokeHistory } from '../../hooks'
import TerminalLogs from '../modules/TerminalLogs'
import { getBaseUrl } from '../../utils'

interface InvokeDetailViewProps {
  moduleName: string
  invokeName: string
  onBack: () => void
}

type CallOutcome = { ok: true; result: unknown } | { ok: false; error: string }

const getStatusColor = (status: string) => (status === 'completed' ? 'text-green-600' : 'text-red-600')

const formatJson = (value: unknown) => (value === undefined ? 'undefined' : JSON.stringify(value, null, 2))

const InvokeDetailView: React.FC<InvokeDetailViewProps> = ({ moduleName, invokeName, onBack }) => {
  const queryClient = useQueryClient()
  const { data: historyData, isLoading, error } = useInvokeHistory(moduleName, invokeName)
  const history = historyData?.history ?? []

  const [payloadText, setPayloadText] = useState('{}')
  const [isCalling, setIsCalling] = useState(false)
  const [outcome, setOutcome] = useState<CallOutcome | null>(null)

  const endpoint = `/__invoke/${encodeURIComponent(moduleName)}/${encodeURIComponent(invokeName)}`

  const handleCall = async () => {
    let payload: unknown
    try {
      payload = payloadText.trim() ? JSON.parse(payloadText) : undefined
    } catch {
      setOutcome({ ok: false, error: 'Payload is not valid JSON' })
      return
    }

    setIsCalling(true)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payload }),
      })
      const body = await response.json().catch(() => ({}))
      setOutcome(response.ok
        ? { ok: true, result: body.result }
        : { ok: false, error: body.error ?? `Request failed with status ${response.status}` })
    } catch (err) {
      setOutcome({ ok: false, error: (err as Error).message })
    } finally {
      setIsCalling(false)
      queryClient.invalidateQueries({ queryKey: ['invoke-history', moduleName, invokeName] })
      queryClient.invalidateQueries({ queryKey: ['modules'] })
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">Loading invoke details...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Error loading invoke: {error.message}</div>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Back to Module
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={onBack}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            ← Back to {moduleName}
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{invokeName}</h1>
            <p className="text-gray-600">Invoke trigger in {moduleName} module</p>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Available Endpoint</h3>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              POST
            </span>
            <code className="text-xs font-mono text-gray-700">{getBaseUrl()}{endpoint}</code>
            <span className="text-xs text-gray-500">- Call the trigger, body is {'{ "payload": ... }'}</span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            From code: <code className="font-mono">cloudInvoke().invoke("{moduleName}", "{invokeName}", payload)</code>,
            or <code className="font-mono">"namespace/{moduleName}"</code> from another namespace.
          </p>
        </div>
      </div>

      {/* Call form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Call Trigger</h3>
        <label className="block text-sm font-medium text-gray-600 mb-1">Payload (JSON)</label>
        <textarea
          value={payloadText}
          onChange={(e) => setPayloadText(e.target.value)}
          rows={6}
          spellCheck={false}
          className="w-full text-sm font-mono bg-gray-50 p-2 rounded border focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
        <div className="mt-3 flex items-center space-x-3">
          <button
            onClick={handleCall}
            disabled={isCalling}
            className="px-4 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-sm disabled:opacity-50"
          >
            {isCalling ? 'Calling...' : '🚀 Call'}
          </button>
        </div>

        {outcome && (
          <div className="mt-4">
            <label className={`block text-sm font-medium mb-1 ${outcome.ok ? 'text-green-700' : 'text-red-700'}`}>
              {outcome.ok ? 'Result' : 'Error'}
            </label>
            <pre className={`text-xs font-mono p-3 rounded border overflow-x-auto ${outcome.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {outcome.ok ? formatJson(outcome.result) : outcome.error}
            </pre>
          </div>
        )}
      </div>

      {/* Execution History */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Execution History</h3>
          <span className="text-xs text-gray-500">
            {history.length} call{history.length !== 1 ? 's' : ''} (from any caller, including other namespaces)
          </span>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No calls recorded yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((execution) => (
              <details key={execution.id} className="p-4">
                <summary className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium capitalize ${getStatusColor(execution.status)}`}>
                      {execution.status}
                    </span>
                    {execution.error && (
                      <span className="text-xs text-red-600 font-mono truncate max-w-md">{execution.error}</span>
                    )}
                    <span className="text-xs text-gray-400">{execution.duration}ms</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(execution.startTime).toLocaleString()}
                  </span>
                </summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Payload</label>
                    <pre className="text-xs font-mono bg-gray-50 p-2 rounded border overflow-x-auto">{formatJson(execution.payload)}</pre>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {execution.status === 'completed' ? 'Result' : 'Error'}
                    </label>
                    <pre className="text-xs font-mono bg-gray-50 p-2 rounded border overflow-x-auto">
                      {execution.status === 'completed' ? formatJson(execution.result) : execution.error}
                    </pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* Invoke Logs */}
      <TerminalLogs
        moduleName={moduleName}
        title={`${invokeName} Invoke Logs`}
      />
    </div>
  )
}

export default InvokeDetailView
