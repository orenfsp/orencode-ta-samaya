import { Link, useParams } from 'react-router'
import { fullName, roleLabels, roleStatusLabels, useMe, type Role } from '@/entities/session'
import { routes } from '@/shared/config'
import { cn } from '@/shared/lib'
import { IconArrowRight, PageHeader } from '@/shared/ui'
import { cabinetNav } from '@/widgets/cabinet-shell'

/** Обзор кабинета роли: карточки разделов (собираются из меню кабинета) и статусы всех ролей аккаунта */
export function CabinetPage() {
  const { data: me } = useMe()
  const role = useParams().role as Role
  if (!me) return null
  const sections = cabinetNav(role).filter((item) => !item.end)

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        crumbs={[{ label: 'Главная', to: routes.home }, { label: 'Кабинет' }]}
        title="Обзор"
        description={`${fullName(me)} · ${roleLabels[role]}`}
      />

      {sections.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-sm text-primary-text">Разделы</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sections.map(({ label, to, icon: Icon, description, tone }, index) => (
              <Link
                key={to}
                to={to}
                style={{ animationDelay: `${index * 50}ms` }}
                className="group grid-texture flex animate-rise flex-col gap-6 rounded-lg border border-line-soft p-6 transition-[border-color,translate] duration-340 ease-emphasized hover:-translate-y-1 hover:border-line focus-visible:field-focus"
              >
                <Icon size={24} className={tone === 'live' ? 'text-live-text' : 'text-primary-text'} />
                <span className="mt-auto flex flex-col gap-2">
                  <span className="flex items-center gap-2 text-h3 font-medium">
                    {label}
                    <IconArrowRight
                      size={18}
                      className="text-muted transition-[translate,color] duration-220 group-hover:translate-x-1 group-hover:text-ink"
                    />
                  </span>
                  <span className="text-body text-muted">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-sm text-primary-text">Роли аккаунта</h2>
        <ul className="grid max-w-3xl divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
          {me.roles.map((item, index) => {
            const open = me.available_roles.includes(item.role)
            return (
              <li
                key={item.role}
                style={{ animationDelay: `${index * 50}ms` }}
                className="flex animate-rise flex-col gap-2 p-5"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-lead">{roleLabels[item.role]}</span>
                  <span
                    className={cn(
                      'flex items-center gap-1.5 text-sm',
                      item.status === 'rejected' ? 'text-danger-text' : open ? 'text-ink' : 'text-muted',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-1.5 rounded-full',
                        item.status === 'rejected' ? 'bg-danger' : open ? 'bg-primary' : 'bg-line',
                      )}
                    />
                    {item.status === 'rejected'
                      ? 'Отклонена'
                      : item.role === 'coach' && item.status === 'verified'
                        ? 'Верифицирован'
                        : open
                          ? 'Кабинет открыт'
                          : roleStatusLabels[item.status]}
                  </span>
                </span>
                <span className="text-sm text-muted">
                  {item.status === 'rejected' && item.reject_reason
                    ? `Причина: ${item.reject_reason}`
                    : open
                      ? item.role === role
                        ? 'Вы сейчас здесь'
                        : 'Переключиться можно в меню кабинета'
                      : 'Федерация проверит заявку, решение придёт уведомлением'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
