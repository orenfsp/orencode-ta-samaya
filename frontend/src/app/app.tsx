import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { queryClient } from '@/shared/api'
import { Toaster, TooltipLayer } from '@/shared/ui'
import { router } from './router'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
      <TooltipLayer />
    </QueryClientProvider>
  )
}
