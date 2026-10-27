import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'fsp.theme'
const listeners = new Set<() => void>()

const read = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#F4F4F4' : '#1B1C21')
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Не запомнили — выбор проживёт до перезагрузки, это не ошибка для человека
  }
  listeners.forEach((listener) => listener())
}

/**
 * Сменить тему. Если браузер умеет View Transitions — новая тема раскрывается кругом от точки (кнопки).
 * Тема изначально выставляется скриптом в index.html до первого кадра.
 */
export function setTheme(theme: Theme, origin?: { x: number; y: number }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const doc = document as Document & { startViewTransition?: (callback: () => void) => unknown }
  if (!doc.startViewTransition || reduced) return apply(theme)
  if (origin) {
    document.documentElement.style.setProperty('--theme-x', `${origin.x}px`)
    document.documentElement.style.setProperty('--theme-y', `${origin.y}px`)
  }
  doc.startViewTransition(() => apply(theme))
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  return useSyncExternalStore(subscribe, read, () => 'dark' as Theme)
}
