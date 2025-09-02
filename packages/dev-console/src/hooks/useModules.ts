import { useQuery } from '@tanstack/react-query'
import { ModulesResponse } from '../types/api'

const API_BASE = ''

export const useModules = () => {
  return useQuery<ModulesResponse>({
    queryKey: ['modules'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/modules`)
      if (!response.ok) {
        throw new Error('Failed to fetch modules')
      }
      return response.json()
    },
    refetchInterval: 3000,
  })
}