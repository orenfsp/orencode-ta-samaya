import { personAvatar } from '@/entities/person'
import { Link, NavLink, useNavigate } from 'react-router'
import { fullName, roleLabels, useLogout, type Me, type Role } from '@/entities/session'
import { NotificationSheet } from '@/features/notification-center'
import { routes } from '@/shared/config'
import { cn } from '@/shared/lib'
import {
  Avatar,
  BrandLogo,
  IconButton,
  IconChevronDown,
  IconLogOut,
  IconShieldCheck,
  Menu,
  showToast,
  ThemeToggle,
} from '@/shared/ui'
import { cabinetNav } from '../model/nav'

/** Содержимое боковой панели — общее для десктопа и мобильного меню */
export function Sidebar({
  me,
  role,
  unread = 0,
  onNavigate,
}: {
  me: Me
  role: Role
  /** Непрочитанные уведомления — числом на колокольчике у переключателя темы */
  unread?: number
  onNavigate?: () => void
}) {
  const navigate = useNavigate()
  const logout = useLogout()
  const otherRoles = me.available_roles.filter((item) => item !== role)
  const pending = me.roles.filter((item) => !me.available_roles.includes(item.role))
  const hasPage = me.roles.some((item) => item.status === 'verified')
  const verifiedCoach = me.roles.some((item) => item.role === 'coach' && item.status === 'verified')

  return (
    <div className="flex h-full flex-col">
      <Link to={routes.home} aria-label="На главную" className="self-start rounded-sm px-2 pt-1">
        <BrandLogo className="h-7 w-auto" />
      </Link>

      {/* Смена роли без повторного входа: кабинеты ролей живут по своим адресам */}
      <div className="mt-6">
        {otherRoles.length ? (
          <Menu
            aria-label="Сменить кабинет"
            items={me.available_roles.map((item) => ({
              id: item,
              label: roleLabels[item],
              selected: item === role,
              onSelect: () => {
                onNavigate?.()
                navigate(routes.cabinetRole(item))
              },
            }))}
            trigger={(props) => (
              <button
                type="button"
                {...props}
                className="group flex w-full pressable items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-hover-tint"
              >
                <span className="flex-1 truncate text-body text-ink">{roleLabels[role]}</span>
                <IconChevronDown
                  size={16}
                  className={cn(
                    'text-muted transition-[rotate,color] duration-220 ease-emphasized group-hover:text-ink',
                    props['aria-expanded'] && 'rotate-180 text-ink',
                  )}
                />
              </button>
            )}
          />
        ) : (
          <p className="px-3 py-2 text-body text-ink">{roleLabels[role]}</p>
        )}
      </div>

      <nav
        aria-label="Разделы кабинета"
        className="mt-2 flex flex-col gap-0.5 border-t border-line-soft pt-3"
      >
        {cabinetNav(role).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            data-tour={item.to}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-body transition-colors duration-150',
                isActive ? 'bg-primary-soft text-ink' : 'text-muted hover:bg-hover-tint hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Синяя метка активного раздела выезжает слева */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-2 bottom-2 left-0 w-0.5 origin-center rounded-full bg-primary transition-[scale] duration-340 ease-emphasized',
                    isActive ? 'scale-y-100' : 'scale-y-0',
                  )}
                />
                <item.icon
                  size={18}
                  className={isActive ? 'text-primary-text' : 'text-muted group-hover:text-ink'}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {pending.length > 0 && (
        <div className="mt-6 flex flex-col gap-1.5 px-3">
          <p className="text-xs text-muted">Ожидают подтверждения</p>
          {pending.map((item) => (
            <p key={item.role} className="flex items-center justify-between gap-2 text-sm text-ink">
              {roleLabels[item.role]}
              <span className={item.status === 'rejected' ? 'text-live-text' : 'text-muted'}>
                {item.status === 'rejected' ? 'отклонена' : 'на проверке'}
              </span>
            </p>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-1 border-t border-line-soft px-1 pt-4">
        <Avatar name={`${me.last_name} ${me.first_name}`} src={personAvatar(me.id)} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1 text-sm text-ink">
            {hasPage ? (
              <Link
                to={routes.person(me.id)}
                className="truncate rounded-sm link-underline focus-visible:field-focus"
                data-tooltip="Моя страница"
              >
                {fullName(me)}
              </Link>
            ) : (
              <span className="truncate">{fullName(me)}</span>
            )}
            {verifiedCoach && (
              <span data-tooltip="Тренер проверен ФСП" aria-label="Тренер проверен ФСП" role="img">
                <IconShieldCheck size={14} className="shrink-0 text-primary-text" />
              </span>
            )}
          </span>
          <span className="truncate text-xs text-muted">{me.email}</span>
        </div>
        <span data-tour="notifications" className="inline-flex rounded-md">
          <NotificationSheet role={role} unread={unread} />
        </span>
        <ThemeToggle className="size-9" />
        <IconButton
          aria-label="Выйти"
          icon={<IconLogOut size={18} />}
          size="sm"
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              onSuccess: () => {
                showToast('Вы вышли из аккаунта', { tone: 'success' })
                navigate(routes.home, { replace: true })
              },
            })
          }
        />
      </div>
    </div>
  )
}
