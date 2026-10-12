import { useQuery } from '@tanstack/react-query'
import { StorageBucketsResponse, StorageObjectsResponse } from '../types/api'

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
