import type { ReactNode } from 'react'

export type ToastTone = 'info' | 'success' | 'danger'

interface ToastItem {
  id: number
  title: ReactNode
  description?: ReactNode
  tone: ToastTone
  action?: ToastAction
  leaving: boolean
}

/** Действие в тосте: «Вернуть» после архивации и т. п. Нажатие закрывает тост */
export interface ToastAction {
  label: string
  onClick: () => void
}

const DURATION_MS = 4000
// С кнопкой — дольше: человеку нужно успеть прочитать и нажать
const DURATION_WITH_ACTION_MS = 7000
const EXIT_MS = 200

let toasts: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit(next: ToastItem[]) {
  toasts = next
  listeners.forEach((listener) => listener())
}

export function dismissToast(id: number) {
  if (!toasts.some((toast) => toast.id === id && !toast.leaving)) return
  emit(toasts.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)))
  setTimeout(() => emit(toasts.filter((toast) => toast.id !== id)), EXIT_MS)
}

/** Короткое сообщение о результате действия. Контейнер <Toaster /> стоит один раз в корне приложения */
export function showToast(
  title: ReactNode,
  options: { description?: ReactNode; tone?: ToastTone; action?: ToastAction } = {},
) {
  const id = nextId++
  emit([
    ...toasts.slice(-3),
    {
      id,
      title,
      description: options.description,
      tone: options.tone ?? 'info',
      action: options.action,
      leaving: false,
    },
  ])
  setTimeout(() => dismissToast(id), options.action ? DURATION_WITH_ACTION_MS : DURATION_MS)
  return id
}

export const subscribeToasts = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getToasts = () => toasts
