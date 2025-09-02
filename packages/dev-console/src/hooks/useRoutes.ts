import { useQuery } from '@tanstack/react-query'
import { RoutesResponse, RegistryStats } from '../types/api'

const API_BASE = ''

export const useRoutes = () => {
  return useQuery<RoutesResponse>({
    queryKey: ['routes'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/routes`)
      if (!response.ok) {
        throw new Error('Failed to fetch routes')
      }
      return response.json()
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  })
}

export const useRoutesByMethod = (method: string) => {
  return useQuery<RoutesResponse>({
    queryKey: ['routes', method],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/routes/${method}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch ${method} routes`)
      }
      return response.json()
    },
    enabled: !!method,
    refetchInterval: 5000,
  })
}

export const useRegistryStats = () => {
  return useQuery<RegistryStats>({
    queryKey: ['registry-stats'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/registry/stats`)
      if (!response.ok) {
        throw new Error('Failed to fetch registry stats')
      }
      return response.json()
    },
    refetchInterval: 5000,
  })
}