import React from 'react'
import { useParams, useNavigate } from 'react-router'
import QueueDetailView from '../components/queues/QueueDetailView'

const QueueDetailPage: React.FC = () => {
  const { moduleName, queueName } = useParams<{ moduleName: string; queueName: string }>()
  const navigate = useNavigate()

  const handleBack = () => {
    navigate(`/modules/${moduleName}`)
  }

  if (!moduleName || !queueName) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Invalid queue parameters</div>
        <button
          onClick={() => navigate('/modules')}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Back to Modules
        </button>
      </div>
    )
  }

  return (
    <QueueDetailView
      moduleName={moduleName}
      queueName={queueName}
      onBack={handleBack}
    />
  )
}

export default QueueDetailPage