import { useEffect, useState } from 'react'

/** Обратный отсчёт до повторной отправки кода: тикает раз в секунду, пока больше нуля */
export function useCountdown(seconds = 60) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (left <= 0) return
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [left])
  return [left, () => setLeft(seconds)] as const
}
