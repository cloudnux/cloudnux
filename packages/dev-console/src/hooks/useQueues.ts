import { useQuery } from '@tanstack/react-query'
import { QueuesResponse, QueueDetails } from '../types/api'

const API_BASE = ''

export const useQueues = () => {
  return useQuery<QueuesResponse>({
    queryKey: ['queues'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/queues`)
      if (!response.ok) {
        throw new Error('Failed to fetch queues')
      }
      return response.json()
    },
    refetchInterval: 3000,
  })
}

export const useQueueDetails = (queueName: string) => {
  return useQuery<QueueDetails>({
    queryKey: ['queue', queueName],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/queues/${queueName}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch queue ${queueName}`)
      }
      return response.json()
    },
    enabled: !!queueName,
    refetchInterval: 3000,
  })
}