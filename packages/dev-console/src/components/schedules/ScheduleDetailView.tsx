import React from 'react'
import { useScheduleDetails } from '../../hooks'
import TerminalLogs from '../modules/TerminalLogs'

interface ScheduleDetailViewProps {
  moduleName: string
  scheduleName: string
  onBack: () => void
}

const ScheduleDetailView: React.FC<ScheduleDetailViewProps> = ({ moduleName, scheduleName, onBack }) => {
  const { data: scheduleData, isLoading, error } = useScheduleDetails(scheduleName)

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">Loading schedule details...</div>
      </div>
    )
  }

  if (error || !scheduleData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-600">Error loading schedule: {error?.message}</div>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Back to Module
        </button>
      </div>
    )
  }

  const handleTriggerNow = async () => {
    try {
      const response = await fetch(`/console/schedules/${scheduleName}/trigger`, {
        method: 'POST'
      })
      if (response.ok) {
        const result = await response.json()
        alert(result.message || 'Schedule triggered successfully')
      } else {
        const error = await response.json()
        alert(`Failed to trigger schedule: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to trigger schedule:', error)
      alert('Failed to trigger schedule')
    }
  }

  const handleToggleEnabled = async () => {
    try {
      const action = scheduleData.job.enabled ? 'disable' : 'enable'
      const response = await fetch(`/console/schedules/${scheduleName}/${action}`, {
        "method": "PUT"
      })
      if (response.ok) {
        const result = await response.json()
        alert(result.message || `Schedule ${action}d successfully`)
      } else {
        const error = await response.json()
        alert(`Failed to ${action} schedule: ${error.error}`)
      }
    } catch (error) {
      console.error(`Failed to toggle schedule:`, error)
      alert('Failed to toggle schedule')
    }
  }

  const formatNextRun = (nextRun: string) => {
    const date = new Date(nextRun)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `in ${diffDays} days`
    if (diffHours > 0) return `in ${diffHours} hours`
    if (diffMinutes > 0) return `in ${diffMinutes} minutes`
    if (diffSeconds > 0) return `in ${diffSeconds} seconds`
    return 'now'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              ← Back to {moduleName}
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{scheduleName}</h1>
              <p className="text-gray-600">Scheduled Job in {moduleName} module</p>
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleTriggerNow}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
            >
              🚀 Trigger Now
            </button>
            <button
              onClick={handleToggleEnabled}
              className={`px-4 py-2 rounded text-sm ${scheduleData.job.enabled
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
            >
              {scheduleData.job.enabled ? '⏸ Disable' : '▶️ Enable'}
            </button>
          </div>
        </div>

        {/* Schedule URLs Overview */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Available Endpoints</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  GET
                </span>
                <code className="text-xs font-mono text-gray-700">http://localhost:3000/schedules/{scheduleName}</code>
                <span className="text-xs text-gray-500">- Get schedule details</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  POST
                </span>
                <code className="text-xs font-mono text-gray-700">http://localhost:3000/schedules/{scheduleName}/trigger</code>
                <span className="text-xs text-gray-500">- Trigger job now</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                  PUT
                </span>
                <code className="text-xs font-mono text-gray-700">http://localhost:3000/schedules/{scheduleName}/enable</code>
                <span className="text-xs text-gray-500">- Enable schedule</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                  PUT
                </span>
                <code className="text-xs font-mono text-gray-700">http://localhost:3000/schedules/{scheduleName}/disable</code>
                <span className="text-xs text-gray-500">- Disable schedule</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p className={`text-2xl font-bold ${scheduleData.job.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                {scheduleData.job.enabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${scheduleData.job.enabled ? 'bg-green-100' : 'bg-gray-100'
              }`}>
              <svg className={`w-6 h-6 ${scheduleData.job.enabled ? 'text-green-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Running</p>
              <p className={`text-2xl font-bold ${scheduleData.isRunning ? 'text-blue-600' : 'text-gray-400'}`}>
                {scheduleData.isRunning ? 'Yes' : 'No'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${scheduleData.isRunning ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
              <svg className={`w-6 h-6 ${scheduleData.isRunning ? 'text-blue-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Run Count</p>
              <p className="text-2xl font-bold text-purple-600">{scheduleData.job.runCount || 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H9a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Next Run</p>
              <p className="text-sm font-bold text-orange-600">
                {formatNextRun(scheduleData.job.nextRun)}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(scheduleData.job.nextRun).toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Details */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Cron Expression</label>
              <code className="block text-sm font-mono bg-gray-50 p-2 rounded border">
                {scheduleData.job.cronExpression}
              </code>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Created At</label>
              <div className="text-sm text-gray-700">
                {new Date(scheduleData.job.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Job ID</label>
              <code className="block text-xs font-mono bg-gray-50 p-2 rounded border break-all">
                {scheduleData.job.id}
              </code>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Timer Status</label>
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${scheduleData.timerId === 'scheduled'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
                }`}>
                {scheduleData.timerId}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Logs */}
      <TerminalLogs 
        moduleName={moduleName}
        triggerName={scheduleName}
        triggerType="schedule"
        title={`${scheduleName} Schedule Logs`}
      />
    </div>
  )
}

export default ScheduleDetailView