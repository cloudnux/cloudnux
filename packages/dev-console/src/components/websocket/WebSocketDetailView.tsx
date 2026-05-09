import React, { useState } from 'react'
import { useWebSocketPath, useSendWebSocketMessage } from '../../hooks'
import TerminalLogs from '../modules/TerminalLogs'
import { getBaseUrl } from '../../utils'

interface WebSocketDetailViewProps {
  moduleName: string
  wsPath: string
  onBack: () => void
}

const WebSocketDetailView: React.FC<WebSocketDetailViewProps> = ({ moduleName, wsPath, onBack }) => {
  const { data, isLoading, error, refetch } = useWebSocketPath(wsPath)
  const { send } = useSendWebSocketMessage()

  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [messageBody, setMessageBody] = useState('{\n  \n}')
  const [sendStatus, setSendStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [isSending, setIsSending] = useState(false)

  const connections = data?.connections || []
  const targetConnection = selectedConnectionId || connections[0]?.connectionId || null

  const handleSend = async () => {
    if (!targetConnection) return
    setIsSending(true)
    setSendStatus(null)
    try {
      let payload: any
      try {
        payload = JSON.parse(messageBody)
      } catch {
        setSendStatus({ ok: false, text: 'Invalid JSON in message body' })
        setIsSending(false)
        return
      }
      await send(targetConnection, payload)
      setSendStatus({ ok: true, text: 'Message sent successfully' })
      refetch()
    } catch (err) {
      setSendStatus({ ok: false, text: err instanceof Error ? err.message : 'Send failed' })
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">Loading WebSocket details...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Error loading WebSocket path: {(error as Error).message}</div>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
          Back to Module
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              ← Back to {moduleName}
            </button>
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <span className="inline-flex items-center px-3 py-1 rounded text-sm font-medium bg-indigo-100 text-indigo-800">
                  WS
                </span>
                <h1 className="text-2xl font-semibold text-gray-900 font-mono">{wsPath}</h1>
              </div>
              <p className="text-gray-600">WebSocket endpoint in {moduleName} module</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Connection URL */}
        <div className="border-t border-gray-200 pt-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">WebSocket URL</label>
          <code className="block text-sm font-mono bg-gray-50 p-3 rounded border">
            {getBaseUrl().replace(/^http/, 'ws')}{wsPath}
          </code>
        </div>
      </div>

      {/* Active Connections */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Active Connections</h3>
          <span className={`px-2 py-1 rounded text-sm font-medium ${connections.length > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
            {connections.length} connected
          </span>
        </div>

        {connections.length === 0 ? (
          <div className="text-center text-gray-500 py-6 border border-dashed rounded-lg">
            No active connections on this path
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((conn) => (
              <div
                key={conn.connectionId}
                onClick={() => setSelectedConnectionId(conn.connectionId)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  (selectedConnectionId || connections[0]?.connectionId) === conn.connectionId
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <code className="text-sm font-mono text-gray-800">{conn.connectionId}</code>
                  </div>
                  <span className="text-xs text-gray-500">
                    connected {new Date(conn.connectedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send Message */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Send Message</h3>

        {connections.length === 0 ? (
          <div className="text-gray-500 text-sm">No active connections to send to.</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Connection</label>
              <select
                value={targetConnection || ''}
                onChange={(e) => setSelectedConnectionId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {connections.map((conn) => (
                  <option key={conn.connectionId} value={conn.connectionId}>
                    {conn.connectionId}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message (JSON)</label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter JSON message..."
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSend}
                disabled={isSending || !targetConnection}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSending ? 'Sending...' : 'Send Message'}
              </button>
              {sendStatus && (
                <span className={`text-sm ${sendStatus.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {sendStatus.text}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Logs */}
      <TerminalLogs
        moduleName={moduleName}
        title={`${wsPath} WebSocket Logs`}
      />
    </div>
  )
}

export default WebSocketDetailView
