import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { RouteInfo, QueueInfo, ScheduleInfo } from '../../types/api'

type TriggerType = 'http' | 'queue' | 'schedule'
type ColorType = 'green' | 'blue' | 'purple'

interface TriggerCardProps {
  type: TriggerType
  title: string
  count: number
  color: ColorType
  items: RouteInfo[] | QueueInfo[] | ScheduleInfo[]
  moduleName?: string
}

const TriggerCard: React.FC<TriggerCardProps> = ({ type, title, count, color, items, moduleName }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const navigate = useNavigate()

  const getColorClasses = (color: ColorType) => {
    switch (color) {
      case 'green':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          header: 'bg-green-100',
          text: 'text-green-800',
          badge: 'bg-green-500'
        }
      case 'blue':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          header: 'bg-blue-100',
          text: 'text-blue-800',
          badge: 'bg-blue-500'
        }
      case 'purple':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          header: 'bg-purple-100',
          text: 'text-purple-800',
          badge: 'bg-purple-500'
        }
    }
  }

  const colors = getColorClasses(color)

  const renderItem = (item: any, index: number) => {
    if (type === 'http') {
      const route = item as RouteInfo
      return (
        <div 
          key={index} 
          className="p-2 bg-white rounded border text-xs cursor-pointer hover:bg-green-50 transition-colors"
          onClick={() => moduleName && navigate(`/modules/${moduleName}/routes?url=${encodeURIComponent(route.url)}&method=${route.method}`)}
        >
          <div className="flex items-center space-x-2">
            <span className={`px-1 py-0.5 rounded text-xs font-medium ${
              route.method === 'GET' ? 'bg-green-100 text-green-700' :
              route.method === 'POST' ? 'bg-blue-100 text-blue-700' :
              route.method === 'PUT' ? 'bg-orange-100 text-orange-700' :
              route.method === 'DELETE' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {Array.isArray(route.method) ? route.method.join(',') : route.method}
            </span>
            <span className="font-mono">{route.url}</span>
          </div>
        </div>
      )
    }

    if (type === 'queue') {
      const queue = item as QueueInfo
      return (
        <div 
          key={index} 
          className="p-2 bg-white rounded border text-xs cursor-pointer hover:bg-blue-50 transition-colors"
          onClick={() => moduleName && navigate(`/modules/${moduleName}/queues/${queue.name}`)}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{queue.name}</span>
            {queue.stats && (
              <div className="flex space-x-1">
                <span className="text-green-600">I:{queue.stats.incoming}</span>
                <span className="text-yellow-600">P:{queue.stats.processing}</span>
                <span className="text-red-600">D:{queue.stats.dlq}</span>
              </div>
            )}
          </div>
        </div>
      )
    }

    if (type === 'schedule') {
      const schedule = item as ScheduleInfo
      return (
        <div 
          key={index} 
          className="p-2 bg-white rounded border text-xs cursor-pointer hover:bg-purple-50 transition-colors"
          onClick={() => moduleName && navigate(`/modules/${moduleName}/schedules/${schedule.name}`)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`px-1 py-0.5 rounded text-xs ${
                schedule.isRunning ? 'bg-yellow-100 text-yellow-700' :
                schedule.enabled ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {schedule.isRunning ? 'RUN' : schedule.enabled ? 'ON' : 'OFF'}
              </span>
              <span className="font-medium">{schedule.name}</span>
            </div>
            {schedule.cronExpression && (
              <span className="font-mono text-gray-600">{schedule.cronExpression}</span>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${colors.border} ${colors.bg}`}>
      <div 
        className={`p-4 cursor-pointer hover:opacity-80 transition-opacity ${colors.header}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className={`w-3 h-3 rounded-full ${colors.badge}`}></span>
            <span className={`font-medium ${colors.text}`}>{title}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-2xl font-bold ${colors.text}`}>{count}</span>
            <span className="text-gray-400 text-sm">
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>
        </div>
      </div>

      {isExpanded && count > 0 && (
        <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
          {items.map((item, index) => renderItem(item, index))}
        </div>
      )}
    </div>
  )
}

export default TriggerCard