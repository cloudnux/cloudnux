import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

export interface LogEntry {
  id: string
  timestamp: string
  levelName: string
  message: string
  meta?: Record<string, any>
  module: string
  reqId: string
}

interface LogsResponse {
  logs: LogEntry[]
}

const API_BASE = ''

interface LogFilters {
  limit?: number
  level?: string
  module?: string
  reqId?: string
}

export const useLogs = (filters: LogFilters = {}) => {
  const { limit = 100, level, module, reqId } = filters
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)

  const query = useQuery<LogsResponse>({
    queryKey: ['logs', limit, level, module, reqId],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('limit', limit.toString())
      if (level) params.append('level', level)
      if (module) params.append('module', module)
      if (reqId) params.append('reqId', reqId)

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

    const streamParams = new URLSearchParams()
    if (level) streamParams.append('level', level)
    if (module) streamParams.append('module', module)
    if (reqId) streamParams.append('reqId', reqId)

    const eventSource = new EventSource(`${API_BASE}/console/logs/stream?${streamParams}`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'initial') {
          queryClient.setQueryData(['logs', limit, level, module, reqId], {
            logs: data.logs
          })
        } else if (data.type === 'log') {
          queryClient.setQueryData(['logs', limit, level, module, reqId], (oldData: LogsResponse | undefined) => {
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
  }, [queryClient, limit, level, module, reqId])

  return query
}

export const useClearLogs = () => {
  const queryClient = useQueryClient()

  const clearLogs = async () => {
    const response = await fetch(`${API_BASE}/console/logs`, {
      method: 'DELETE'
    })

    if (response.ok) {
      queryClient.invalidateQueries({ queryKey: ['logs'] })
      return response.json()
    }

    throw new Error('Failed to clear logs')
  }

  return { clearLogs }
}
