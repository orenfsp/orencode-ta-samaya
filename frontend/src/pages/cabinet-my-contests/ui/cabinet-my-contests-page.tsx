import { useState } from 'react'
import { useParams } from 'react-router'
import {
  activeMembers,
  applicationTone,
  canManage,
  isOpenForChanges,
  personName,
  useMyApplications,
  type Application,
  type ApplicationRole,
} from '@/entities/application'
import { CompetitionCard, teamSize } from '@/entities/competition'
import { useMe } from '@/entities/session'
import {
  AcademicGroupForm,
  ApplicationDrawer,
  EnrollDrawer,
  useApplicationActions,
  type ApplicationActions,
} from '@/features/application-manage'
import { routes } from '@/shared/config'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormAlert,
  IconPlus,
  PageHeader,
  Skeleton,
  StatusTag,
} from '@/shared/ui'
import { CalendarAside } from '@/widgets/calendar-aside'

const HIDDEN = ['withdrawn'] as const

function ApplicationTile({
  item,
  userId,
  actions,
  onOpen,
}: {
  item: Application
  userId: string
  actions: ApplicationActions
  onOpen: () => void
}) {
  const team = item.contest.participation_type === 'team'
  const members = activeMembers(item)
  const mine = item.members.find((member) => member.user.id === userId)
  const invited = mine?.confirmation === 'invited' && mine.is_active && isOpenForChanges(item)
  const size = teamSize(item.contest)
  return (
    <CompetitionCard
      competition={item.contest}
      extra={
        <div className="flex flex-col gap-1.5 border-t border-line-soft pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusTag tone={applicationTone[item.status]}>{item.status_title}</StatusTag>
            {team && (
              <span className="font-mono text-sm text-muted">
                {members.length} из {size}
              </span>
            )}
          </div>
          {item.team_name && <span className="truncate text-body text-ink">{item.team_name}</span>}
          {!team && !mine && item.members[0] && (
            <span className="truncate text-body text-ink">
              {personName(item.members[0].user)}
              <span className="text-sm text-muted"> · {item.members[0].confirmation_title}</span>
            </span>
          )}
          {invited && (
            <span className="text-sm text-live-text">
              {item.creator.last_name} {item.creator.first_name} зовёт вас в {team ? 'команду' : 'заявку'}
            </span>
          )}
          {item.status === 'rejected' && item.reject_reason && (
            <span className="text-sm text-live-text">Отказ: {item.reject_reason}</span>
          )}
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {invited ? (
            <Button
              size="sm"
              loading={actions.act.isPending && actions.act.variables?.item.id === item.id}
              onClick={() => actions.act.mutate({ item, action: 'confirm' })}
            >
              Подтвердить участие
            </Button>
          ) : null}
          <Button size="sm" variant={invited ? 'ghost' : 'secondary'} onClick={onOpen}>
            {canManage(item, userId) && team && isOpenForChanges(item) ? 'Состав и заявка' : 'Заявка'}
          </Button>
          <Button size="sm" variant="text" to={routes.competition(item.contest.id)} className="ml-auto">
            Соревнование
          </Button>
        </div>
      }
    />
  )
}

/** «Мои соревнования»: спортсмен — свои заявки и приглашения, тренер — заявки за подопечных */
export function CabinetMyContestsPage() {
  const role = useParams().role as ApplicationRole
  const coach = role === 'coach'
  const { data: me } = useMe()
  const applications = useMyApplications(role)
  const actions = useApplicationActions()
  const [enroll, setEnroll] = useState(false)
  // Каждое открытие «Записаться» — с выбора соревнования, без прошлого черновика
  const [enrollKey, setEnrollKey] = useState(0)
  const [openId, setOpenId] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editGroup, setEditGroup] = useState(false)

  if (!me) return null
  const all = (applications.data ?? []).filter(
    (item) => !HIDDEN.includes(item.status as (typeof HIDDEN)[number]),
  )
  const invitations = all.filter((item) =>
    item.members.some(
      (member) => member.user.id === me.id && member.confirmation === 'invited' && member.is_active,
    ),
  )
  const rest = all.filter((item) => !invitations.includes(item))
  const current = (applications.data ?? []).find((item) => item.id === openId) ?? null
  const marks = rest
    .filter((item) => item.status !== 'rejected')
    .map((item) => ({
      id: item.id,
      title: item.team_name ? `${item.contest.title} · ${item.team_name}` : item.contest.title,
      start: item.contest.starts_on,
      end: item.contest.ends_on,
      to: routes.competition(item.contest.id),
    }))
  const open = (id: number) => {
    setOpenId(id)
    setDrawerOpen(true)
  }
  const enrollButton = (
    <Button
      leftIcon={<IconPlus size={18} />}
      onClick={() => {
        setEnrollKey((current) => current + 1)
        setEnroll(true)
      }}
    >
      {coach ? 'Записать спортсменов' : 'Записаться'}
    </Button>
  )
  const grid = 'grid gap-4 sm:grid-cols-2 2xl:grid-cols-3'

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole(role) },
          { label: 'Мои соревнования' },
        ]}
        title="Мои соревнования"
        description={
          coach
            ? 'Заявки за подопечных. Каждый спортсмен подтверждает участие сам'
            : 'Ваши заявки и приглашения в команды'
        }
        actions={enrollButton}
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {!coach &&
            (!me.academic_group || editGroup ? (
              <Card className="flex flex-col gap-4">
                {!me.academic_group && (
                  <FormAlert tone="info">Укажите академическую группу: без неё заявку не принять</FormAlert>
                )}
                <AcademicGroupForm onSaved={() => setEditGroup(false)} />
              </Card>
            ) : (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-muted">
                Академическая группа: <span className="text-ink">{me.academic_group.name}</span>
                <Button size="sm" variant="text" onClick={() => setEditGroup(true)}>
                  Изменить
                </Button>
              </p>
            ))}

          {applications.isPending ? (
            <div className={grid}>
              {[1, 2].map((id) => (
                <Skeleton key={id} className="h-96 rounded-xl" />
              ))}
            </div>
          ) : applications.isError ? (
            <ErrorState error={applications.error} onRetry={() => applications.refetch()} />
          ) : !all.length ? (
            <Card>
              <EmptyState
                title={coach ? 'Заявок за подопечных пока нет' : 'Вы ещё никуда не записаны'}
                description="Записаться можно на соревнования с открытой регистрацией"
                action={enrollButton}
              />
            </Card>
          ) : (
            <>
              {invitations.length > 0 && (
                <section className="flex flex-col gap-4" aria-label="Приглашения">
                  <h2 className="text-h3 font-medium">
                    Приглашения <span className="font-mono text-live-text">{invitations.length}</span>
                  </h2>
                  <div className={grid}>
                    {invitations.map((item) => (
                      <ApplicationTile
                        key={item.id}
                        item={item}
                        userId={me.id}
                        actions={actions}
                        onOpen={() => open(item.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
              {rest.length > 0 && (
                <section className="flex flex-col gap-4" aria-label="Заявки">
                  {invitations.length > 0 && <h2 className="text-h3 font-medium">Заявки</h2>}
                  <div className={grid}>
                    {rest.map((item) => (
                      <ApplicationTile
                        key={item.id}
                        item={item}
                        userId={me.id}
                        actions={actions}
                        onOpen={() => open(item.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <CalendarAside marks={marks} />
      </div>

      <EnrollDrawer
        key={enrollKey}
        open={enroll}
        role={role}
        actions={actions}
        onClose={() => setEnroll(false)}
      />
      <ApplicationDrawer
        item={current}
        userId={me.id}
        actions={actions}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
