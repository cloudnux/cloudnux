import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTopicDetails } from '../../hooks'
import { getBaseUrl } from '../../utils'

interface TopicDetailViewProps {
  topicName: string
  onBack: () => void
}

const TopicDetailView: React.FC<TopicDetailViewProps> = ({ topicName, onBack }) => {
  const { data: topicData, isLoading, error } = useTopicDetails(topicName)
  const navigate = useNavigate()
  const [showPublishForm, setShowPublishForm] = useState(false)
  const [messageJson, setMessageJson] = useState('{\n  "message": "",\n  "data": {}\n}')
  const [attributesJson, setAttributesJson] = useState('{\n  "custom-header": "value"\n}')

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">Loading topic details...</div>
      </div>
    )
  }

  if (error || !topicData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Error loading topic: {error?.message}</div>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Back to Topics
        </button>
      </div>
    )
  }

  const handlePublish = async () => {
    try {
      const messageData = JSON.parse(messageJson)
      const attributesData = JSON.parse(attributesJson)

      const headers = {
        'Content-Type': 'application/json',
        ...attributesData
      }

      const response = await fetch(`/console/topics/${topicName}/publish`, {
        method: 'POST',
        headers,
        body: JSON.stringify(messageData)
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Published to ${result.results.length} subscriber${result.results.length !== 1 ? 's' : ''}`)
        setShowPublishForm(false)
        setMessageJson('{\n  "message": "",\n  "data": {}\n}')
        setAttributesJson('{\n  "custom-header": "value"\n}')
      } else {
        const err = await response.json()
        alert(`Failed to publish: ${err.error}`)
      }
    } catch {
      alert('Invalid JSON format in message or attributes')
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
              ← Back to Topics
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{topicName}</h1>
              <p className="text-gray-600">
                {topicData.subscribers.length} subscriber{topicData.subscribers.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowPublishForm(!showPublishForm)}
            className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
          >
            + Publish Message
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="inline-flex items-center px-2 py-0.5 rounded font-medium bg-blue-100 text-blue-800">
            POST
          </span>
          <code className="font-mono text-gray-700">{getBaseUrl()}/queues/topics/{topicName}</code>
          <span className="text-gray-500">- runtime publish endpoint (fans out to every subscriber)</span>
        </div>
      </div>

      {/* Publish Message Form */}
      {showPublishForm && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Publish Message to Topic</h3>
            <button
              onClick={() => setShowPublishForm(false)}
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
                Delivered to every subscriber - same message, independent backlog/DLQ per subscriber
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handlePublish}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Publish
              </button>
              <button
                onClick={() => setShowPublishForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscribers */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Subscribers</h3>
        </div>

        {topicData.subscribers.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No subscribers</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {topicData.subscribers.map((sub) => (
              <div
                key={sub.queueName}
                onClick={() => sub.module && navigate(`/modules/${sub.module}/queues/${sub.queueName}`)}
                className={`p-4 flex items-center justify-between ${sub.module ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">{sub.queueName}</div>
                  {sub.module && <div className="text-xs text-gray-500">module: {sub.module}</div>}
                </div>
                {sub.stats && (
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-green-700">{sub.stats.incoming} incoming</span>
                    <span className="text-yellow-700">{sub.stats.processing} processing</span>
                    {sub.stats.dlq > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-medium bg-red-100 text-red-800">
                        {sub.stats.dlq} DLQ
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TopicDetailView
