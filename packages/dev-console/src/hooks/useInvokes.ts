import { useQuery } from '@tanstack/react-query'
import { InvokeHistoryResponse } from '../types/api'

const API_BASE = ''

export const useInvokeHistory = (moduleName: string, invokeName: string) => {
  return useQuery<InvokeHistoryResponse>({
    queryKey: ['invoke-history', moduleName, invokeName],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/invokes/${encodeURIComponent(moduleName)}/${encodeURIComponent(invokeName)}/history`)
      if (!response.ok) {
        throw new Error(`Failed to fetch history for ${moduleName}:${invokeName}`)
      }
      return response.json()
    },
    enabled: !!moduleName && !!invokeName,
    refetchInterval: 3000,
  })
}
