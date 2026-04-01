import React from 'react'
import { useParams, useNavigate } from 'react-router'
import WebSocketDetailView from '../components/websocket/WebSocketDetailView'

const WebSocketDetailPage: React.FC = () => {
  const { moduleName, '*': wsPathWild } = useParams<{ moduleName: string; '*': string }>()
  const navigate = useNavigate()

  const handleBack = () => {
    navigate(`/modules/${moduleName}`)
  }

  if (!moduleName || !wsPathWild) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Invalid WebSocket parameters</div>
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
    <WebSocketDetailView
      moduleName={moduleName}
      wsPath={'/' + wsPathWild}
      onBack={handleBack}
    />
  )
}

export default WebSocketDetailPage
