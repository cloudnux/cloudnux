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

  const httpRoutes = module.routes
  const queues = module.queues
  const schedules = module.schedules
  const websockets = module.websockets ?? []

  const triggerCards = [
    httpRoutes.length > 0 && { type: 'http' as const, title: 'HTTP Endpoints', count: httpRoutes.length, color: 'green' as const, items: httpRoutes },
    queues.length > 0 && { type: 'queue' as const, title: 'Event Queues', count: queues.length, color: 'blue' as const, items: queues },
    schedules.length > 0 && { type: 'schedule' as const, title: 'Scheduled Jobs', count: schedules.length, color: 'purple' as const, items: schedules },
    websockets.length > 0 && { type: 'websocket' as const, title: 'WebSockets', count: websockets.length, color: 'indigo' as const, items: websockets },
  ].filter(Boolean) as { type: any; title: string; count: number; color: any; items: any[] }[]

  const gridCols = triggerCards.length <= 2 ? 'md:grid-cols-2' : triggerCards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'

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
            {httpRoutes.length > 0 && <span>{httpRoutes.length} routes</span>}
            {queues.length > 0 && <span>{queues.length} queues</span>}
            {schedules.length > 0 && <span>{schedules.length} schedules</span>}
            {websockets.length > 0 && <span>{websockets.length} websockets</span>}
          </div>
        </div>
      </div>

      {/* Trigger Cards */}
      <div className={`grid grid-cols-1 gap-6 ${gridCols}`}>
        {triggerCards.map(card => (
          <TriggerCard
            key={card.type}
            type={card.type}
            title={card.title}
            count={card.count}
            color={card.color}
            items={card.items}
            moduleName={moduleName}
          />
        ))}
      </div>

      {/* Terminal Logs */}
      <TerminalLogs moduleName={moduleName} />
    </div>
  )
}

export default ModuleDetailView