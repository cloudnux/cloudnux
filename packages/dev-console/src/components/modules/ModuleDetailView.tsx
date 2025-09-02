import React from 'react'
import { useModules } from '../../hooks'
import TriggerCard from './TriggerCard'
import TerminalLogs from './TerminalLogs'

interface ModuleDetailViewProps {
  moduleName: string
  onBack: () => void
}

const ModuleDetailView: React.FC<ModuleDetailViewProps> = ({ moduleName, onBack }) => {
  const { data: modulesData, isLoading } = useModules()

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">Loading module details...</div>
      </div>
    )
  }

  const module = modulesData?.modules.find(m => m.name === moduleName)

  if (!module) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Module not found: {moduleName}</div>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Back to Modules
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">{module.name}</h1>
            <span className="px-2 py-1 text-xs font-medium rounded bg-indigo-100 text-indigo-800">
              MODULE
            </span>
          </div>
          <div className="flex space-x-4 text-sm text-gray-600">
            <span>{module.routes.length} routes</span>
            <span>{module.queues.length} queues</span>
            <span>{module.schedules.length} schedules</span>
          </div>
        </div>
      </div>

      {/* Trigger Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TriggerCard
          type="http"
          title="HTTP Endpoints"
          count={module.routes.length}
          color="green"
          items={module.routes}
          moduleName={moduleName}
        />
        <TriggerCard
          type="queue"
          title="Event Queues"
          count={module.queues.length}
          color="blue"
          items={module.queues}
          moduleName={moduleName}
        />
        <TriggerCard
          type="schedule"
          title="Scheduled Jobs"
          count={module.schedules.length}
          color="purple"
          items={module.schedules}
          moduleName={moduleName}
        />
      </div>

      {/* Terminal Logs */}
      <TerminalLogs moduleName={moduleName} />
    </div>
  )
}

export default ModuleDetailView