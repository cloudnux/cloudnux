import React from 'react'
import { useParams, useNavigate } from 'react-router'
import ModuleDetailView from '../components/modules/ModuleDetailView'

const ModuleDetailPage: React.FC = () => {
  const { moduleName } = useParams<{ moduleName: string }>()
  const navigate = useNavigate()

  const handleBack = () => {
    navigate('/modules')
  }

  if (!moduleName) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Invalid module name</div>
        <button
          onClick={handleBack}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Back to Modules
        </button>
      </div>
    )
  }

  return <ModuleDetailView moduleName={moduleName} onBack={handleBack} />
}

export default ModuleDetailPage