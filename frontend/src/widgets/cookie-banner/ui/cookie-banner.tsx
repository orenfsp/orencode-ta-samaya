import { useState } from 'react'
import { Link } from 'react-router'
import { routes } from '@/shared/config'
import { cn } from '@/shared/lib'

const STORAGE_KEY = 'fsp.cookie-accepted'
const EXIT_MS = 260

// Хранилище может быть недоступно (приватный режим, запрет сайта) — тогда просто показываем баннер
function readAccepted() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Светлая плашка снизу, как на fsp-russia.ru. Не перекрывает контент на телефоне: только по ширине экрана снизу */
export function CookieBanner() {
  const [visible, setVisible] = useState(() => !readAccepted())
  const [leaving, setLeaving] = useState(false)

  if (!visible) return null

  const accept = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Не запомнили — покажем ещё раз в следующий визит, это не ошибка для человека
    }
    setLeaving(true)
    setTimeout(() => setVisible(false), EXIT_MS)
  }

  return (
    <div
      role="region"
      aria-label="Уведомление о cookie"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-2 sm:p-4"
    >
      <div
        className={cn(
          'pointer-events-auto flex w-full max-w-shell animate-pop-in flex-col gap-4 rounded-lg bg-paper px-5 py-4 text-on-paper sm:flex-row sm:items-center sm:px-8',
          'transition-[opacity,translate] duration-260 ease-in',
          leaving && 'translate-y-4 opacity-0',
        )}
      >
        <p className="flex-1 text-body">
          Сайт использует cookie только для входа в аккаунт.{' '}
          <Link to={routes.cookies} className="text-primary underline underline-offset-4">
            Какие именно
          </Link>
        </p>
        <button
          type="button"
          onClick={accept}
          className="min-h-11 shrink-0 pressable rounded-md bg-primary px-8 text-body font-medium text-white hover:bg-primary-hover"
        >
          Понятно
        </button>
      </div>
    </div>
  )
}
