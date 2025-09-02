import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

export interface LogEntry {
  id: string
  timestamp: string
  level: 'fatal' | 'error' | 'warn' | 'info' | 'debug'
  message: string
  meta?: Record<string, any>
  source?: string
  module?: string
  trigger?: string
  triggerType?: 'http' | 'queue' | 'schedule'
}

interface LogsResponse {
  logs: LogEntry[]
}

const API_BASE = ''

interface LogFilters {
  limit?: number
  level?: string
  source?: string
  module?: string
  trigger?: string
  triggerType?: string
}

export const useLogs = (filters: LogFilters = {}) => {
  const { limit = 100, level, source, module, trigger, triggerType } = filters
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)

  const query = useQuery<LogsResponse>({
    queryKey: ['logs', limit, level, source, module, trigger, triggerType],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('limit', limit.toString())
      if (level) params.append('level', level)
      if (source) params.append('source', source)
      if (module) params.append('module', module)
      if (trigger) params.append('trigger', trigger)
      if (triggerType) params.append('triggerType', triggerType)
      
      const response = await fetch(`${API_BASE}/console/logs?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch logs')
      }
      return response.json()
    },
    refetchInterval: 5000, // Fallback polling
  })

  // Setup Server-Sent Events for real-time updates
  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const eventSource = new EventSource(`${API_BASE}/console/logs/stream`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'initial') {
          // Replace entire logs with initial data
          queryClient.setQueryData(['logs', limit, level, source, module, trigger, triggerType], {
            logs: data.logs
          })
        } else if (data.type === 'log') {
          // Add new log to existing data
          queryClient.setQueryData(['logs', limit, level, source, module, trigger, triggerType], (oldData: LogsResponse | undefined) => {
            if (!oldData) return { logs: [data.log] }
            
            const newLogs = [data.log, ...oldData.logs].slice(0, limit)
            return { logs: newLogs }
          })
        }
      } catch (error) {
        console.error('Failed to parse SSE data:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [queryClient, limit, level, source, module, trigger, triggerType])

  return query
}

export const useClearLogs = () => {
  const queryClient = useQueryClient()
  
  const clearLogs = async () => {
    const response = await fetch(`${API_BASE}/console/logs`, {
      method: 'DELETE'
    })
    
    if (response.ok) {
      // Clear all logs queries
      queryClient.invalidateQueries({ queryKey: ['logs'] })
      return response.json()
    }
    
    throw new Error('Failed to clear logs')
  }
  
  return { clearLogs }
}