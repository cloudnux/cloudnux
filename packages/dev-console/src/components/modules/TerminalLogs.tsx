import React, { useState, useEffect, useRef } from 'react'
import { useLogs, useClearLogs } from '../../hooks'

interface TerminalLogsProps {
  moduleName?: string
  title?: string
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString('en-US', { hour12: false })
  const ms = date.getMilliseconds().toString().padStart(3, '0')
  return `${time}.${ms}`
}

const TerminalLogs: React.FC<TerminalLogsProps> = ({ moduleName, title }) => {
  const [isAutoScroll, setIsAutoScroll] = useState(true)
  const [filter, setFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [expandedMeta, setExpandedMeta] = useState<Set<string>>(new Set())
  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  const toggleMeta = (id: string) => {
    setExpandedMeta(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const { data: logsData, isLoading } = useLogs({
    limit: 200,
    level: levelFilter || undefined,
    module: moduleName,
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

  const getLevelColor = (levelName: string) => {
    switch (levelName.toLowerCase()) {
      case 'fatal': return 'text-red-500'
      case 'error': return 'text-red-400'
      case 'warn': return 'text-yellow-400'
      case 'info': return 'text-blue-400'
      case 'debug': return 'text-gray-400'
      case 'trace': return 'text-gray-500'
      default: return 'text-gray-300'
    }
  }

  const getLevelBadgeColor = (levelName: string) => {
    switch (levelName.toLowerCase()) {
      case 'fatal': return 'bg-red-900 text-red-300'
      case 'error': return 'bg-red-800 text-red-200'
      case 'warn': return 'bg-yellow-800 text-yellow-200'
      case 'info': return 'bg-blue-800 text-blue-200'
      case 'debug': return 'bg-gray-700 text-gray-300'
      case 'trace': return 'bg-gray-800 text-gray-400'
      default: return 'bg-gray-700 text-gray-300'
    }
  }

  const filteredLogs = logs.filter(log => {
    const text = filter.toLowerCase()
    if (!text) return true
    return (
      log.message.toLowerCase().includes(text) ||
      log.levelName.toLowerCase().includes(text) ||
      log.module?.toLowerCase().includes(text) ||
      log.reqId?.toLowerCase().includes(text)
    )
  })

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
              {title || (moduleName ? `${moduleName} — Logs` : 'Logs')}
            </span>
            {filteredLogs.length > 0 && (
              <span className="text-xs text-gray-500">{filteredLogs.length} entries</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-gray-700 text-gray-300 border border-gray-600 rounded focus:outline-none focus:border-blue-500 w-36"
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
              <option value="trace">Trace</option>
            </select>
            <button
              onClick={handleClearLogs}
              className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              Clear
            </button>
            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={isAutoScroll}
                onChange={(e) => setIsAutoScroll(e.target.checked)}
                className="text-blue-500"
              />
              <span className="text-xs text-gray-400">Auto-scroll</span>
            </label>
          </div>
        </div>
      </div>

      {/* Terminal Content */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="bg-gray-900 p-3 h-96 overflow-y-auto font-mono text-xs"
      >
        {isLoading ? (
          <div className="text-gray-500 text-center py-8">Loading logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {filter || levelFilter ? 'No logs match your filters' : 'No logs yet'}
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredLogs.map((log) => (
              <div key={log.id} className="hover:bg-gray-800 px-2 py-0.5 rounded group">
                <div className="flex items-start gap-2">
                  {/* Timestamp */}
                  <span className="text-gray-600 shrink-0 tabular-nums">
                    {formatTimestamp(log.timestamp)}
                  </span>

                  {/* Level badge */}
                  <span className={`shrink-0 uppercase font-bold px-1 rounded leading-4 ${getLevelBadgeColor(log.levelName)}`}>
                    {log.levelName.slice(0, 4)}
                  </span>

                  {/* Module tag */}
                  {log.module && (
                    <span className="text-purple-400 shrink-0 font-medium">
                      [{log.module}]
                    </span>
                  )}

                  {/* Message */}
                  <span className={`break-all flex-1 ${getLevelColor(log.levelName)}`}>
                    {log.message}
                  </span>

                  {/* reqId (shown on hover) */}
                  {log.reqId && (
                    <span className="text-gray-700 group-hover:text-gray-500 shrink-0 transition-colors">
                      {log.reqId}
                    </span>
                  )}
                </div>

                {/* Meta (JSON object attached to the log call) */}
                {log.meta && Object.keys(log.meta).length > 0 && (
                  <div className="ml-6 mt-0.5 mb-1">
                    <button
                      onClick={() => toggleMeta(log.id)}
                      className="text-gray-600 hover:text-gray-400 select-none"
                    >
                      {expandedMeta.has(log.id) ? '▼' : '▶'} meta ({Object.keys(log.meta).length})
                    </button>
                    {expandedMeta.has(log.id) && (
                      <pre className="text-gray-500 whitespace-pre-wrap break-all">
                        {JSON.stringify(log.meta, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
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
