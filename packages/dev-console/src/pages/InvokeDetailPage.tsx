import React from 'react'
import { useParams, useNavigate } from 'react-router'
import InvokeDetailView from '../components/invokes/InvokeDetailView'

const InvokeDetailPage: React.FC = () => {
  const { moduleName, invokeName } = useParams<{ moduleName: string; invokeName: string }>()
  const navigate = useNavigate()

  const handleBack = () => {
    navigate(`/modules/${moduleName}`)
  }

  if (!moduleName || !invokeName) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Invalid invoke parameters</div>
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
    <InvokeDetailView
      moduleName={moduleName}
      invokeName={invokeName}
      onBack={handleBack}
    />
  )
}

export default InvokeDetailPage
