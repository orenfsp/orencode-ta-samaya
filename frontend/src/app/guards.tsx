import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { useMe, type Role } from '@/entities/session'
import { routes } from '@/shared/config'
import { ErrorState, Spinner } from '@/shared/ui'

function SessionPending() {
  return (
    <div className="grid min-h-[50dvh] place-items-center text-muted" aria-busy="true">
      <Spinner className="size-6" />
    </div>
  )
}

/** Без сессии — на вход, а после входа обратно сюда */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe()
  const location = useLocation()
  if (me.isPending) return <SessionPending />
  if (me.isError) return <ErrorState error={me.error} onRetry={() => me.refetch()} retrying={me.isFetching} />
  if (!me.data) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`${routes.login}?next=${next}`} replace />
  }
  return children
}

/** Вход и регистрация вошедшему не нужны — сразу в кабинет. Пока сессия не проверена, форму не прячем */
export function GuestOnly({ children }: { children: ReactNode }) {
  const me = useMe()
  if (me.data) return <Navigate to={routes.cabinet} replace />
  return children
}

/** Раздел только для одной роли: из чужого кабинета по прямой ссылке — на его обзор */
export function RequireCabinetRole({ role, children }: { role: Role | Role[]; children: ReactNode }) {
  const params = useParams()
  if (!([] as Role[]).concat(role).includes(params.role as Role))
    return <Navigate to={routes.cabinetRole(params.role ?? '')} replace />
  return children
}
