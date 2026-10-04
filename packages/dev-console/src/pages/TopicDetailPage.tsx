import React from 'react'
import { useParams, useNavigate } from 'react-router'
import TopicDetailView from '../components/topics/TopicDetailView'

const TopicDetailPage: React.FC = () => {
  const { topicName } = useParams<{ topicName: string }>()
  const navigate = useNavigate()

  if (!topicName) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Invalid topic name</div>
        <button
          onClick={() => navigate('/topics')}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Back to Topics
        </button>
      </div>
    )
  }

  return <TopicDetailView topicName={topicName} onBack={() => navigate('/topics')} />
}

export default TopicDetailPage
