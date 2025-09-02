import React, { useState } from 'react'
import { useQueueDetails } from '../../hooks'
import TerminalLogs from '../modules/TerminalLogs'

interface QueueDetailViewProps {
  moduleName: string
  queueName: string
  onBack: () => void
}

const QueueDetailView: React.FC<QueueDetailViewProps> = ({ moduleName, queueName, onBack }) => {
  const { data: queueData, isLoading, error } = useQueueDetails(queueName)
  const [activeTab, setActiveTab] = useState<'incoming' | 'processing' | 'dlq'>('incoming')
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [showEnqueueForm, setShowEnqueueForm] = useState(false)
  const [messageJson, setMessageJson] = useState('{\n  "message": "",\n  "data": {}\n}')
  const [attributesJson, setAttributesJson] = useState('{\n  "custom-header": "value"\n}')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEndpoints, setShowEndpoints] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">Loading queue details...</div>
      </div>
    )
  }

  if (error || !queueData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Error loading queue: {error?.message}</div>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Back to Module
        </button>
      </div>
    )
  }

  const handleProcessDLQ = async () => {
    try {
      const response = await fetch(`/console/queues/${queueName}/process-dlq`)
      if (response.ok) {
        const result = await response.json()
        alert(result.message || 'DLQ processing completed')
        // React Query will auto-refetch due to interval
      } else {
        const error = await response.json()
        alert(`Failed to process DLQ: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to process DLQ:', error)
      alert('Failed to process DLQ')
    }
  }

  const handlePurgeDLQ = async () => {
    if (confirm('Are you sure you want to purge all DLQ messages? This cannot be undone.')) {
      try {
        const response = await fetch(`/console/queues/${queueName}/purge-dlq`)
        if (response.ok) {
          const result = await response.json()
          alert(result.message || 'DLQ purged successfully')
          // React Query will auto-refetch due to interval
        } else {
          const error = await response.json()
          alert(`Failed to purge DLQ: ${error.error}`)
        }
      } catch (error) {
        console.error('Failed to purge DLQ:', error)
        alert('Failed to purge DLQ')
      }
    }
  }

  const handleEnqueueMessage = async () => {
    try {
      const messageData = JSON.parse(messageJson)
      const attributesData = JSON.parse(attributesJson)

      const headers = {
        'Content-Type': 'application/json',
        ...attributesData
      }

      const response = await fetch(`/console/queues/${queueName}/enqueue`, {
        method: 'POST',
        headers,
        body: JSON.stringify(messageData)
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Message enqueued with ID: ${result.id}`)
        setShowEnqueueForm(false)
        setMessageJson('{\n  "message": "",\n  "data": {}\n}')
        setAttributesJson('{\n  "custom-header": "value"\n}')
      } else {
        const error = await response.json()
        alert(`Failed to enqueue: ${error.error}`)
      }
    } catch {
      alert('Invalid JSON format in message or attributes')
    }
  }

  const toggleMessageExpansion = (messageId: string) => {
    const newExpanded = new Set(expandedMessages)
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId)
    } else {
      newExpanded.add(messageId)
    }
    setExpandedMessages(newExpanded)
  }

  const handleDeleteQueue = async () => {
    try {
      const response = await fetch(`/console/queues/${queueName}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        alert(result.message || 'Queue deleted successfully')
        onBack() // Navigate back to module view
      } else {
        const error = await response.json()
        alert(`Failed to delete queue: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to delete queue:', error)
      alert('Failed to delete queue')
    }
    setShowDeleteConfirm(false)
  }

  const getMessages = () => {
    switch (activeTab) {
      case 'incoming': return queueData.messages.incoming
      case 'processing': return queueData.messages.processing
      case 'dlq': return queueData.messages.dlq
      default: return []
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
              <h1 className="text-2xl font-semibold text-gray-900">{queueName}</h1>
              <p className="text-gray-600">Event Queue in {moduleName} module</p>
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => setShowEnqueueForm(!showEnqueueForm)}
              className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
            >
              + Enqueue Message
            </button>
            {queueData.stats && queueData.stats.dlq > 0 && (
              <>
                <button
                  onClick={handleProcessDLQ}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                >
                  Process DLQ ({queueData.stats.dlq})
                </button>
                <button
                  onClick={handlePurgeDLQ}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                >
                  Purge DLQ
                </button>
              </>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
            >
              🗑️ Delete Queue
            </button>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Queue</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete the queue <strong>{queueName}</strong>?
              This will permanently remove the queue and all its messages. This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleDeleteQueue}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete Queue
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue Endpoints Card */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div
          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200"
          onClick={() => setShowEndpoints(!showEndpoints)}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Queue Endpoints</h3>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    POST
                  </span>
                  <code className="text-xs font-mono text-gray-700">http://localhost:3000/queues/{queueName}</code>
                  <span className="text-xs text-gray-500">- Enqueue message</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    GET
                  </span>
                  <code className="text-xs font-mono text-gray-700">http://localhost:3000/queues/{queueName}</code>
                  <span className="text-xs text-gray-500">- Get queue details</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    GET
                  </span>
                  <code className="text-xs font-mono text-gray-700">http://localhost:3000/queues/{queueName}/process-dlq</code>
                  <span className="text-xs text-gray-500">- Process DLQ messages</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    GET
                  </span>
                  <code className="text-xs font-mono text-gray-700">http://localhost:3000/queues/{queueName}/purge-dlq</code>
                  <span className="text-xs text-gray-500">- Purge DLQ messages</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    GET
                  </span>
                  <code className="text-xs font-mono text-gray-700">http://localhost:3000/queues/dashboard</code>
                  <span className="text-xs text-gray-500">- All queues overview</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    DELETE
                  </span>
                  <code className="text-xs font-mono text-gray-700">http://localhost:3000/queues/{queueName}</code>
                  <span className="text-xs text-gray-500">- Delete queue</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Queue Configuration Card */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div
          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200"
          onClick={() => setShowConfig(!showConfig)}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Queue Configuration</h3>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${showConfig ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {showConfig && queueData.stats?.configuration && (
          <div className="p-6">
            <div className="space-y-6">
              {/* Processing Configuration */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Processing Configuration</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Batch Size</label>
                    <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                      {queueData.stats.configuration.batchSize} messages
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Batch Window</label>
                    <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                      {queueData.stats.configuration.batchWindowMs}ms
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Max Retries</label>
                    <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                      {queueData.stats.configuration.maxRetries} attempts
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Parallel Processing</label>
                    <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                      {queueData.stats.configuration.parallel ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Max Concurrent</label>
                    <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                      {queueData.stats.configuration.maxConcurrent} workers
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Retry Backoff</label>
                    <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                      {queueData.stats.configuration.retryBackoff ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Persistence Configuration */}
              {queueData.stats.configuration.persistence && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">Persistence Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Persistence</label>
                      <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                        {queueData.stats.configuration.persistence.enabled ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Data Directory</label>
                      <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border font-mono">
                        {queueData.stats.configuration.persistence.directory}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Save Interval</label>
                      <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                        {queueData.stats.configuration.persistence.saveInterval}ms
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Save on Shutdown</label>
                      <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                        {queueData.stats.configuration.persistence.saveOnShutdown ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Load on Startup</label>
                      <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                        {queueData.stats.configuration.persistence.loadOnStartup ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Incoming Messages</p>
              <p className="text-3xl font-bold text-green-600">{queueData?.stats?.incoming}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Processing</p>
              <p className="text-3xl font-bold text-yellow-600">{queueData?.stats?.processing}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Dead Letter Queue</p>
              <p className="text-3xl font-bold text-red-600">{queueData?.stats?.dlq}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Enqueue Message Form */}
      {showEnqueueForm && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Enqueue New Message</h3>
            <button
              onClick={() => setShowEnqueueForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message JSON
              </label>
              <textarea
                value={messageJson}
                onChange={(e) => setMessageJson(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter message JSON..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message Attributes (Headers)
              </label>
              <textarea
                value={attributesJson}
                onChange={(e) => setAttributesJson(e.target.value)}
                className="w-full h-24 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter attributes JSON..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Custom headers/attributes to include with the message
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleEnqueueMessage}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Enqueue Message
              </button>
              <button
                onClick={() => setShowEnqueueForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages View */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {['incoming', 'processing', 'dlq'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {tab} ({
                  tab === 'incoming' ? queueData?.stats?.incoming :
                    tab === 'processing' ? queueData?.stats?.processing :
                      queueData?.stats?.dlq
                })
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {getMessages().length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No messages in {activeTab} queue
              </div>
            ) : (
              getMessages().map((message: any, index: number) => {
                const isExpanded = expandedMessages.has(message.id)
                return (
                  <div key={index} className="border border-gray-200 rounded bg-gray-50">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleMessageExpansion(message.id)}
                            className="flex items-center space-x-1 text-xs font-mono text-gray-500 hover:text-gray-700"
                          >
                            <svg
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <span>ID: {message.id}</span>
                          </button>
                          {message.error && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              Error
                            </span>
                          )}
                          {message.reprocessed && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Reprocessed
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(message.timestamp || Date.now()).toLocaleString()}
                        </span>
                      </div>

                      {!isExpanded && (
                        <div className="text-sm text-gray-600 truncate">
                          {message.payload?.message || JSON.stringify(message.payload).substring(0, 80) + '...'}
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-200 p-4 bg-white">
                        <div className="space-y-3">
                          {message.payload && (
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-1">Payload:</div>
                              <pre className="text-sm bg-gray-50 p-3 rounded border overflow-x-auto">
                                {JSON.stringify(message.payload, null, 2)}
                              </pre>
                            </div>
                          )}

                          {message.error && (
                            <div>
                              <div className="text-xs font-medium text-red-600 mb-1">Error:</div>
                              <div className="text-sm bg-red-50 p-3 rounded border text-red-800">
                                {message.error}
                              </div>
                            </div>
                          )}

                          {message.attempts && (
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-1">Attempts:</div>
                              <div className="text-sm text-gray-700">{message.attempts}</div>
                            </div>
                          )}

                          {message.attributes && Object.keys(message.attributes).length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-1">Headers:</div>
                              <pre className="text-sm bg-gray-50 p-3 rounded border overflow-x-auto">
                                {JSON.stringify(message.attributes, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Queue Logs */}
      <TerminalLogs 
        moduleName={moduleName}
        triggerName={queueName}
        triggerType="queue"
        title={`${queueName} Queue Logs`}
      />
    </div>
  )
}

export default QueueDetailView