import { useRouteError } from 'react-router'
import { ErrorState } from '@/shared/ui'

/** Последний рубеж: вместо белого экрана — понятное сообщение и перезагрузка */
export function RouteError() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)

  return (
    <div className="grid min-h-dvh place-items-center bg-canvas p-4">
      <ErrorState
        title="Страница сломалась"
        description="Попробуйте обновить страницу"
        onRetry={() => window.location.reload()}
      />
    </div>
  )
}
