import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './http'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx повторять бессмысленно — ответ не изменится
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})
