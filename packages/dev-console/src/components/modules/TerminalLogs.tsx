import React, { useState, useEffect, useRef } from 'react'
import { useLogs, useClearLogs } from '../../hooks'

interface TerminalLogsProps {
  moduleName?: string
  triggerName?: string
  triggerType?: 'http' | 'queue' | 'schedule'
  title?: string
}

const TerminalLogs: React.FC<TerminalLogsProps> = ({ 
  moduleName, 
  triggerName, 
  triggerType,
  title 
}) => {
  const [isAutoScroll, setIsAutoScroll] = useState(true)
  const [filter, setFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  const { data: logsData, isLoading } = useLogs({
    limit: 200,
    level: levelFilter || undefined,
    module: moduleName,
    trigger: triggerName,
    triggerType: triggerType
  })
  const { clearLogs } = useClearLogs()

  const logs = logsData?.logs || []

  useEffect(() => {
    if (isAutoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, isAutoScroll])

  const handleScroll = () => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
      setIsAutoScroll(isAtBottom)
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'fatal': return 'text-red-500'
      case 'error': return 'text-red-400'
      case 'warn': return 'text-yellow-400'
      case 'info': return 'text-blue-400'
      case 'debug': return 'text-gray-400'
      default: return 'text-gray-300'
    }
  }

  const getSourceColor = (source?: string) => {
    switch (source) {
      case 'queue': return 'text-blue-300'
      case 'schedule': return 'text-purple-300'
      case 'http': return 'text-green-300'
      default: return 'text-gray-400'
    }
  }

  const filteredLogs = logs.filter(log =>
    log.message.toLowerCase().includes(filter.toLowerCase()) ||
    log.level.toLowerCase().includes(filter.toLowerCase()) ||
    (log.source?.toLowerCase().includes(filter.toLowerCase()))
  )

  const handleClearLogs = async () => {
    try {
      await clearLogs()
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Terminal Header */}
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-gray-300 text-sm font-medium">
              {title || `${moduleName}${triggerName ? ` - ${triggerName}` : ''} - Logs`}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Filter logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-gray-700 text-gray-300 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-gray-700 text-gray-300 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            >
              <option value="">All Levels</option>
              <option value="fatal">Fatal</option>
              <option value="error">Error</option>
              <option value="warn">Warn</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
            <button
              onClick={handleClearLogs}
              className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              Clear
            </button>
            <div className="flex items-center space-x-1">
              <input
                type="checkbox"
                id="autoscroll"
                checked={isAutoScroll}
                onChange={(e) => setIsAutoScroll(e.target.checked)}
                className="text-blue-500"
              />
              <label htmlFor="autoscroll" className="text-xs text-gray-400">
                Auto-scroll
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Content */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="bg-gray-900 p-4 h-96 overflow-y-auto font-mono text-sm"
      >
        {isLoading ? (
          <div className="text-gray-500 text-center py-8">
            Loading logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {filter || levelFilter ? 'No logs match your filters' : 'No logs available'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start space-x-3 hover:bg-gray-800 px-2 py-1 rounded">
                <span className="text-gray-500 text-xs shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={`text-xs font-medium shrink-0 uppercase ${getLevelColor(log.level)}`}>
                  {log.level}
                </span>
                {log.source && (
                  <span className={`text-xs shrink-0 uppercase ${getSourceColor(log.source)}`}>
                    [{log.source}]
                  </span>
                )}
                <span className="text-gray-300 break-all">
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}

export default TerminalLogs