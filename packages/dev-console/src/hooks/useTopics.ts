import { useQuery } from '@tanstack/react-query'
import { TopicsResponse, TopicDetailResponse } from '../types/api'

const API_BASE = ''

export const useTopics = () => {
  return useQuery<TopicsResponse>({
    queryKey: ['topics'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/topics`)
      if (!response.ok) {
        throw new Error('Failed to fetch topics')
      }
      return response.json()
    },
    refetchInterval: 3000,
  })
}

export const useTopicDetails = (topicName: string) => {
  return useQuery<TopicDetailResponse>({
    queryKey: ['topic', topicName],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/topics/${topicName}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch topic ${topicName}`)
      }
      return response.json()
    },
    enabled: !!topicName,
    refetchInterval: 3000,
  })
}
