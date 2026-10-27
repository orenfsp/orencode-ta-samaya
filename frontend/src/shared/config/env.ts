export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? '/api/v1',
  isDev: import.meta.env.DEV,
} as const
