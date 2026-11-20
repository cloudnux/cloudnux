import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  StorageBucketsResponse,
  StorageNotificationRule,
  StorageNotificationRulesResponse,
  StorageObjectsResponse,
} from '../types/api'

const API_BASE = ''

export const useStorageBuckets = () => {
  return useQuery<StorageBucketsResponse>({
    queryKey: ['storage'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/storage`)
      if (!response.ok) {
        throw new Error('Failed to fetch storage buckets')
      }
      return response.json()
    },
    refetchInterval: 5000,
  })
}

export const useStorageObjects = (bucket: string) => {
  return useQuery<StorageObjectsResponse>({
    queryKey: ['storage', bucket],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/storage/${encodeURIComponent(bucket)}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch objects in bucket ${bucket}`)
      }
      return response.json()
    },
    enabled: !!bucket,
    refetchInterval: 3000,
  })
}

export const useStorageNotificationRules = () => {
  return useQuery<StorageNotificationRulesResponse>({
    queryKey: ['storage-notifications'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/storage-notifications`)
      if (!response.ok) {
        throw new Error('Failed to fetch storage notification rules')
      }
      return response.json()
    },
  })
}

const readError = async (response: Response, fallback: string) => {
  try {
    const body = await response.json()
    return body?.error ?? fallback
  } catch {
    return fallback
  }
}

export const useAddStorageNotificationRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rule: StorageNotificationRule) => {
      const response = await fetch(`${API_BASE}/console/storage-notifications`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(rule),
      })
      if (!response.ok) {
        throw new Error(await readError(response, 'Failed to add the rule'))
      }
      return response.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storage-notifications'] }),
  })
}

export const useDeleteStorageNotificationRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE}/console/storage-notifications/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error(await readError(response, 'Failed to delete the rule'))
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storage-notifications'] }),
  })
}
