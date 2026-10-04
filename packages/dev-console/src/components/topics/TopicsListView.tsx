import React from 'react'
import { useTopics } from '../../hooks'

interface TopicsListViewProps {
  onSelect: (name: string) => void
}

const TopicsListView: React.FC<TopicsListViewProps> = ({ onSelect }) => {
  const { data, isLoading, error } = useTopics()
  const topics = data?.topics ?? []

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">Loading topics...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Error loading topics: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-semibold text-gray-900">Topics</h1>
        <p className="text-gray-600">Pub/sub topics - publishing fans a message out to every subscribed queue</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        {topics.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No topics yet - subscribe a queue to one with an SNS-sourced event trigger
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {topics.map((topic) => {
              const totalDlq = topic.subscribers.reduce((sum, s) => sum + (s.stats?.dlq ?? 0), 0)
              return (
                <div
                  key={topic.name}
                  onClick={() => onSelect(topic.name)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">{topic.name}</div>
                    <div className="text-sm text-gray-500">
                      {topic.subscribers.length} subscriber{topic.subscribers.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {totalDlq > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      {totalDlq} in DLQ
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default TopicsListView
