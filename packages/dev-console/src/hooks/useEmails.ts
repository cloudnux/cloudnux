import { useQuery } from '@tanstack/react-query'
import { EmailsResponse, EmailDetailResponse } from '../types/api'

const API_BASE = ''

export const useEmails = () => {
  return useQuery<EmailsResponse>({
    queryKey: ['emails'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/emails`)
      if (!response.ok) {
        throw new Error('Failed to fetch emails')
      }
      return response.json()
    },
    refetchInterval: 3000,
  })
}

export const useEmailDetails = (id: string) => {
  return useQuery<EmailDetailResponse>({
    queryKey: ['email', id],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/emails/${id}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch email ${id}`)
      }
      return response.json()
    },
    enabled: !!id,
  })
}
