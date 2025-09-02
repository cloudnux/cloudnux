import { useQuery } from '@tanstack/react-query'
import { SchedulesResponse, ScheduleDetails } from '../types/api'

const API_BASE = ''

export const useSchedules = () => {
  return useQuery<SchedulesResponse>({
    queryKey: ['schedules'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/schedules`)
      if (!response.ok) {
        throw new Error('Failed to fetch schedules')
      }
      return response.json()
    },
    refetchInterval: 3000,
  })
}

export const useScheduleDetails = (jobName: string) => {
  return useQuery<ScheduleDetails>({
    queryKey: ['schedule', jobName],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/console/schedules/${jobName}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch schedule ${jobName}`)
      }
      return response.json()
    },
    enabled: !!jobName,
    refetchInterval: 3000,
  })
}