import { Link, Navigate, Outlet, useNavigate, useParams } from 'react-router'
import { roleLabels, roleStatusLabels, useLogout, useMe, type Role } from '@/entities/session'
import { routes } from '@/shared/config'
import { BrandLogo, Button } from '@/shared/ui'
import { CabinetShell } from '@/widgets/cabinet-shell'
import { NotificationCenter } from '@/features/notification-center'

/**
 * Кабинет роли из адреса. Чужая или закрытая роль → в первый доступный кабинет,
 * доступных нет (роли на проверке) → на обзор аккаунта.
 */
export function CabinetLayout() {
  const { data: me } = useMe()
  const { role } = useParams()
  if (!me) return null

  if (!me.available_roles.includes(role as Role)) {
    const first = me.available_roles[0]
    return <Navigate to={first ? routes.cabinetRole(first) : routes.cabinet} replace />
  }

  return (
    <CabinetShell me={me} role={role as Role}>
      <Outlet />
    </CabinetShell>
  )
}

/** /cabinet: сразу в первый открытый кабинет; если все роли ещё на проверке — честно об этом */
export function CabinetIndexRedirect() {
  const { data: me } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  if (!me) return null
  const first = me.available_roles[0]
  if (first) return <Navigate to={routes.cabinetRole(first)} replace />

  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="flex w-full max-w-md animate-rise flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Link to={routes.home} aria-label="На главную">
            <BrandLogo className="h-8 w-auto" />
          </Link>
          <NotificationCenter />
        </div>
        <h1 className="text-h2 font-medium">Кабинет откроется после проверки</h1>
        <p className="text-body text-muted">
          Федерация проверит заявку на роль. Решение придёт уведомлением, а кабинет появится здесь.
        </p>
        <ul className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
          {me.roles.map((item) => (
            <li key={item.role} className="flex flex-col gap-1 px-4 py-3">
              <span className="flex justify-between gap-3">
                <span>{roleLabels[item.role]}</span>
                <span className={item.status === 'rejected' ? 'text-danger-text' : 'text-muted'}>
                  {roleStatusLabels[item.status]}
                </span>
              </span>
              {item.reject_reason && (
                <span className="text-sm text-muted">Причина: {item.reject_reason}</span>
              )}
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          loading={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, { onSuccess: () => navigate(routes.home, { replace: true }) })
          }
        >
          Выйти
        </Button>
      </div>
    </div>
  )
}
