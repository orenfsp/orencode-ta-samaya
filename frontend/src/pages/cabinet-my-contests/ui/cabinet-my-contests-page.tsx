import { useState } from 'react'
import { useParams } from 'react-router'
import { applicationTone, personName, type ApplicationRole } from '@/entities/application'
import { CompetitionCard } from '@/entities/competition'
import { useMe } from '@/entities/session'
import {
  AcademicGroupForm,
  canApply,
  ContestApplicationsModal,
  isInvited,
  useApplicationActions,
  useContestEntries,
  type ContestEntry,
} from '@/features/application-manage'
import { routes } from '@/shared/config'
import { Button, Card, EmptyState, ErrorState, FormAlert, PageHeader, Skeleton, StatusTag } from '@/shared/ui'
import { CalendarAside } from '@/widgets/calendar-aside'

function EntryTile({
  entry,
  role,
  userId,
  onOpen,
}: {
  entry: ContestEntry
  role: ApplicationRole
  userId: string
  onOpen: () => void
}) {
  const coach = role === 'coach'
  const { applications } = entry
  const invited = applications.find((item) => isInvited(item, userId))
  const single = !coach && applications.length === 1 ? applications[0] : null
  const team = entry.contest.participation_type === 'team'
  // У тренера на одно соревнование бывает много заявок: в карточке — сколько в каком статусе
  const byStatus = coach
    ? Object.entries(
        applications.reduce<Record<string, number>>((acc, item) => {
          acc[item.status_title] = (acc[item.status_title] ?? 0) + 1
          return acc
        }, {}),
      )
    : []

  const label = invited
    ? 'Ответить на приглашение'
    : applications.length
      ? coach
        ? `Заявки · ${applications.length}`
        : 'Заявка'
      : coach
        ? 'Записать спортсменов'
        : 'Записаться'

  return (
    <CompetitionCard
      competition={entry.contest}
      extra={
        (applications.length > 0 || entry.problems.length > 0) && (
          <div className="flex flex-col gap-1.5 border-t border-line-soft pt-4 text-sm">
            {single && (
              <>
                <StatusTag tone={applicationTone[single.status]}>{single.status_title}</StatusTag>
                {single.team_name && <span className="truncate text-body text-ink">{single.team_name}</span>}
                {single.status === 'rejected' && single.reject_reason && (
                  <span className="text-live-text">Отказ: {single.reject_reason}</span>
                )}
              </>
            )}
            {coach && (
              <span className="text-muted">
                {byStatus.map(([title, count]) => `${title}: ${count}`).join(' · ')}
              </span>
            )}
            {invited && (
              <span className="text-live-text">
                {invited.creator.last_name} {invited.creator.first_name} зовёт вас в{' '}
                {team ? 'команду' : 'заявку'}
                {!team && invited.members[0] && invited.members[0].user.id !== userId
                  ? ` (${personName(invited.members[0].user)})`
                  : ''}
              </span>
            )}
            {!applications.length && entry.problems.length > 0 && (
              <span className="text-live-text">Не подходите: {entry.problems.join('; ')}</span>
            )}
          </div>
        )
      }
      footer={
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={applications.length && !invited ? 'secondary' : 'primary'}
            disabled={!applications.length && !canApply(entry, role)}
            onClick={onOpen}
          >
            {label}
          </Button>
          <Button size="sm" variant="text" to={routes.competition(entry.contest.id)} className="ml-auto">
            Открыть
          </Button>
        </div>
      }
    />
  )
}

/**
 * «Соревнования» у спортсмена и тренера: открытая регистрация и всё, куда уже есть заявки, —
 * по одной карточке на соревнование. Заявки, приглашения и запись — в окне карточки.
 */
export function CabinetMyContestsPage() {
  const role = useParams().role as ApplicationRole
  const coach = role === 'coach'
  const { data: me } = useMe()
  const entries = useContestEntries(role, me?.id)
  const actions = useApplicationActions()
  const [openId, setOpenId] = useState<number | null>(null)
  const [modal, setModal] = useState({ open: false, key: 0 })
  const [editGroup, setEditGroup] = useState(false)

  if (!me) return null
  const current = entries.data.find((entry) => entry.contest.id === openId) ?? null
  const marks = entries.data
    .filter((entry) => entry.applications.some((item) => item.status !== 'rejected'))
    .map(({ contest }) => ({
      id: contest.id,
      title: contest.title,
      start: contest.starts_on,
      end: contest.ends_on,
      to: routes.competition(contest.id),
    }))
  const open = (id: number) => {
    setOpenId(id)
    setModal((state) => ({ open: true, key: state.key + 1 }))
  }
  const grid = 'grid gap-4 md:grid-cols-2'

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole(role) },
          { label: 'Соревнования' },
        ]}
        title="Соревнования"
        description={
          coach
            ? 'Открытая регистрация и заявки за подопечных. Каждый спортсмен подтверждает участие сам'
            : 'Открытая регистрация, ваши заявки и приглашения в команды'
        }
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {!coach &&
            (!me.academic_group || editGroup ? (
              <Card className="flex flex-col gap-4">
                {!me.academic_group && (
                  <FormAlert tone="info">Укажите академическую группу. Без неё заявку не примут</FormAlert>
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

          {entries.isPending ? (
            <div className={grid}>
              {[1, 2].map((id) => (
                <Skeleton key={id} className="h-96 rounded-xl" />
              ))}
            </div>
          ) : entries.isError ? (
            <ErrorState error={entries.error} onRetry={() => entries.refetch()} />
          ) : !entries.data.length ? (
            <Card>
              <EmptyState
                title="Записаться сейчас некуда"
                description="Здесь появятся соревнования, когда откроется регистрация"
                action={
                  <Button variant="secondary" to={routes.competitions}>
                    Все соревнования
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className={grid}>
              {entries.data.map((entry) => (
                <EntryTile
                  key={entry.contest.id}
                  entry={entry}
                  role={role}
                  userId={me.id}
                  onOpen={() => open(entry.contest.id)}
                />
              ))}
            </div>
          )}
        </div>

        <CalendarAside marks={marks} />
      </div>

      {current && (
        <ContestApplicationsModal
          key={modal.key}
          entry={current}
          role={role}
          actions={actions}
          open={modal.open}
          onClose={() => setModal((state) => ({ ...state, open: false }))}
        />
      )}
    </div>
  )
}
