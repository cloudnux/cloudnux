import { useQuery, useQueryClient } from '@tanstack/react-query'
import { WebSocketsResponse, WebSocketPathResponse } from '../types/api'

export const useWebSockets = () => {
  return useQuery<WebSocketsResponse>({
    queryKey: ['websockets'],
    queryFn: async () => {
      const response = await fetch('/console/websockets')
      if (!response.ok) throw new Error('Failed to fetch websocket connections')
      return response.json()
    },
    refetchInterval: 3000,
  })
}

export const useWebSocketPath = (wsPath: string) => {
  return useQuery<WebSocketPathResponse>({
    queryKey: ['websockets', wsPath],
    queryFn: async () => {
      const encoded = wsPath.replace(/^\//, '')
      const response = await fetch(`/console/websockets/${encoded}`)
      if (!response.ok) throw new Error('Failed to fetch websocket path')
      return response.json()
    },
    refetchInterval: 3000,
    enabled: !!wsPath,
  })
}

export const useSendWebSocketMessage = () => {
  const queryClient = useQueryClient()

  const send = async (connectionId: string, data: any) => {
    const response = await fetch(`/console/websockets/${connectionId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(err.error || 'Failed to send message')
    }
    queryClient.invalidateQueries({ queryKey: ['websockets'] })
    return response.json()
  }

  return { send }
}
