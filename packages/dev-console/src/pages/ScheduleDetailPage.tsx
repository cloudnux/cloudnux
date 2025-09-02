import React from 'react'
import { useParams, useNavigate } from 'react-router'
import ScheduleDetailView from '../components/schedules/ScheduleDetailView'

const ScheduleDetailPage: React.FC = () => {
  const { moduleName, scheduleName } = useParams<{ moduleName: string; scheduleName: string }>()
  const navigate = useNavigate()

  const handleBack = () => {
    navigate(`/modules/${moduleName}`)
  }

  if (!moduleName || !scheduleName) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Invalid schedule parameters</div>
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
    <ScheduleDetailView
      moduleName={moduleName}
      scheduleName={scheduleName}
      onBack={handleBack}
    />
  )
}

export default ScheduleDetailPage