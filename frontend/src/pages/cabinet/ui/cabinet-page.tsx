import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useContestsWithApplications } from '@/entities/application'
import { useConsentCount } from '@/entities/consent'
import { CompetitionCard, competitionDates, useManagedCompetitions } from '@/entities/competition'
import { useMyDocuments } from '@/entities/document'
import { toNotificationItem, useNotifications } from '@/entities/notification'
import { useMyJudgeAssignments, useQualificationQueue } from '@/entities/qualification'
import { groupKindTitles, useAthleteRatings } from '@/entities/rating'
import { fullName, roleLabels, roleStatusLabels, useMe, type Me, type Role } from '@/entities/session'
import { useRoleRequestCounts } from '@/features/account-moderate'
import { isInvited, useContestEntries } from '@/features/application-manage'
import { routes } from '@/shared/config'
import { cn } from '@/shared/lib'
import {
  Button,
  EmptyState,
  IconArrowRight,
  NotificationList,
  PageHeader,
  PlaceMark,
  SectionHeader,
  Skeleton,
  StatusTag,
} from '@/shared/ui'

/** Строка очереди: что ждёт решения и сколько. Ноль — «всё разобрано», без красного */
function QueueRow({
  label,
  count,
  to,
  loading,
}: {
  label: string
  count?: number
  to: string
  loading?: boolean
}) {
  return (
    <li>
      <Link
        to={to}
        className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-hover-tint focus-visible:bg-hover-tint focus-visible:outline-none"
      >
        <span className="flex-1 text-body text-ink">{label}</span>
        {loading ? (
          <Skeleton className="h-5 w-8 rounded-sm" />
        ) : (
          <span className={cn('font-mono text-h3 tabular-nums', count ? 'text-live-text' : 'text-muted')}>
            {count ?? 0}
          </span>
        )}
        <IconArrowRight
          size={18}
          className="text-muted transition-[translate,color] duration-220 group-hover:translate-x-1 group-hover:text-ink"
        />
      </Link>
    </li>
  )
}

function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader as="h3" title={title} action={action} />
      {children}
    </section>
  )
}

const list = 'divide-y divide-line-soft overflow-hidden card'

function FederationQueues() {
  const roles = useRoleRequestCounts()
  const verification = useManagedCompetitions('admin', { verification_status: 'pending' }, 1)
  const qualifications = useQualificationQueue(undefined, 'pending')
  const consents = useConsentCount()
  const rolesPending = roles.data
    ? Object.values(roles.data.pending).reduce((sum, value) => sum + value, 0)
    : 0
  return (
    <Block title="Ждёт решения">
      <ul className={list}>
        <QueueRow
          label="Роли на проверке"
          count={rolesPending}
          loading={roles.isPending}
          to={routes.cabinetAccounts}
        />
        <QueueRow
          label="Соревнования на верификации"
          count={verification.data?.total}
          loading={verification.isPending}
          to={`${routes.cabinetCompetitions('federation')}?tab=queue`}
        />
        <QueueRow
          label="Согласия представителей на проверке"
          count={consents.data?.pending}
          loading={consents.isPending}
          to={`${routes.cabinetAccounts}?role=consents`}
        />
        <QueueRow
          label="Разряды и категории на проверке"
          count={qualifications.data?.length}
          loading={qualifications.isPending}
          to={routes.cabinetQualificationsReview}
        />
      </ul>
    </Block>
  )
}

function OrganizerQueues() {
  const contests = useContestsWithApplications('organizer')
  const waiting = (contests.data?.items ?? []).filter((item) => item.counts.submitted > 0).slice(0, 5)
  return (
    <Block
      title="Заявки на рассмотрении"
      action={
        <Button to={routes.cabinetCompetitions('organizer')} variant="ghost" size="sm">
          Соревнования
        </Button>
      }
    >
      {contests.isPending ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : waiting.length ? (
        <ul className={list}>
          {waiting.map((item) => (
            <QueueRow
              key={item.contest.id}
              label={item.contest.title}
              count={item.counts.submitted}
              to={routes.cabinetCompetitions('organizer')}
            />
          ))}
        </ul>
      ) : (
        <div className="card">
          <EmptyState title="Новых заявок нет" />
        </div>
      )}
    </Block>
  )
}

function ParticipantOverview({ me, role }: { me: Me; role: 'athlete' | 'coach' }) {
  const entries = useContestEntries(role, me.id)
  const ratings = useAthleteRatings(role === 'athlete' ? me.id : undefined)
  const documents = useMyDocuments()
  const invited = entries.data.filter((entry) => entry.applications.some((item) => isInvited(item, me.id)))
  const mine = entries.data
    .filter((entry) => entry.applications.length && !invited.includes(entry))
    .slice(0, 2)
  const recent = (documents.data?.items ?? []).slice(0, 3)

  return (
    <>
      {invited.length > 0 && (
        <Block title="Ждут вашего ответа">
          <ul className={list}>
            {invited.map((entry) => (
              <QueueRow
                key={entry.contest.id}
                label={`Приглашение: ${entry.contest.title}`}
                count={entry.applications.length}
                to={routes.cabinetCompetitions(role)}
              />
            ))}
          </ul>
        </Block>
      )}

      <Block
        title={role === 'coach' ? 'Соревнования подопечных' : 'Мои соревнования'}
        action={
          <Button to={routes.cabinetCompetitions(role)} variant="ghost" size="sm">
            Все
          </Button>
        }
      >
        {entries.isPending ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-60 rounded-lg" />
            <Skeleton className="h-60 rounded-lg" />
          </div>
        ) : mine.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {mine.map((entry) => (
              <CompetitionCard key={entry.contest.id} competition={entry.contest} />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              title="Заявок пока нет"
              action={
                <Button to={routes.cabinetCompetitions(role)} variant="secondary">
                  {role === 'coach' ? 'Записать спортсменов' : 'Записаться'}
                </Button>
              }
            />
          </div>
        )}
      </Block>

      {role === 'athlete' && (ratings.data?.length ?? 0) > 0 && (
        <Block
          title="Место в рейтинге"
          action={
            <Button to={routes.cabinetRating(role)} variant="ghost" size="sm">
              Подробнее
            </Button>
          }
        >
          <ul className={list}>
            {ratings.data!.map((item) => (
              <li
                key={`${item.discipline.id}-${item.group_kind}`}
                className="flex items-center gap-4 px-5 py-4"
              >
                <PlaceMark place={item.place} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body text-ink">{item.discipline.name}</span>
                  <span className="text-sm text-muted">
                    {item.group.name} · {groupKindTitles[item.group_kind].toLowerCase()} · из {item.total}
                  </span>
                </span>
                <span className="font-mono text-body text-ink tabular-nums">{item.points}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {recent.length > 0 && (
        <Block
          title="Новые документы"
          action={
            <Button to={routes.cabinetDocuments(role)} variant="ghost" size="sm">
              Все
            </Button>
          }
        >
          <ul className={list}>
            {recent.map((item) => (
              <li key={item.token} className="flex flex-col gap-0.5 px-5 py-3.5">
                <span className="text-body text-ink">{item.title}</span>
                <span className="text-sm text-muted">
                  {item.kind_title} · {item.contest.title}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </>
  )
}

function JudgeOverview() {
  const assignments = useMyJudgeAssignments()
  const items = (assignments.data ?? []).slice(0, 5)
  return (
    <Block
      title="Мои назначения"
      action={
        <Button to={routes.cabinetJudgeAssignments} variant="ghost" size="sm">
          Все
        </Button>
      }
    >
      {assignments.isPending ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : items.length ? (
        <ul className={list}>
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={routes.competition(item.contest.id)}
                className="flex flex-col gap-0.5 px-5 py-3.5 hover:bg-hover-tint"
              >
                <span className="text-body text-ink">{item.contest.title}</span>
                <span className="text-sm text-muted">
                  {item.position.name} · {competitionDates(item.contest)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card">
          <EmptyState title="Назначений пока нет" />
        </div>
      )}
    </Block>
  )
}

function RecentNotifications({ role }: { role: Role }) {
  const notifications = useNotifications({}, 5)
  const items = notifications.data?.items ?? []
  return (
    <Block
      title="Уведомления"
      action={
        <Button to={routes.cabinetNotifications(role)} variant="ghost" size="sm">
          Все
        </Button>
      }
    >
      <div className="overflow-hidden card">
        {notifications.isPending ? (
          <Skeleton className="m-4 h-24 rounded-md" />
        ) : (
          <NotificationList items={items.map((item) => toNotificationItem(item))} />
        )}
      </div>
    </Block>
  )
}

function Roles({ me, role }: { me: Me; role: Role }) {
  return (
    <Block title="Роли аккаунта">
      <ul className={list}>
        {me.roles.map((item) => {
          const open = me.available_roles.includes(item.role)
          const tone = item.status === 'rejected' ? 'cancelled' : open ? 'active' : 'draft'
          const status =
            item.status === 'rejected'
              ? 'Отклонена'
              : item.role === 'coach' && item.status === 'verified'
                ? 'Проверен ФСП'
                : open
                  ? 'Открыт'
                  : roleStatusLabels[item.status]
          return (
            <li key={item.role} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body text-ink">{roleLabels[item.role]}</span>
                {item.status === 'rejected' && item.reject_reason && (
                  <span className="text-sm text-live-text">Причина: {item.reject_reason}</span>
                )}
              </span>
              <StatusTag tone={tone}>{status}</StatusTag>
              {open && item.role !== role && (
                <Button size="sm" variant="ghost" to={routes.cabinetRole(item.role)}>
                  Перейти
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </Block>
  )
}

/** Обзор кабинета: что ждёт решения или ответа по роли, свои соревнования, уведомления и роли аккаунта */
export function CabinetPage() {
  const { data: me } = useMe()
  const role = useParams().role as Role
  if (!me) return null

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        crumbs={[{ label: 'Главная', to: routes.home }, { label: 'Кабинет' }]}
        title="Обзор"
        description={`${fullName(me)} · ${roleLabels[role]}`}
      />
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {role === 'federation' && <FederationQueues />}
          {role === 'organizer' && <OrganizerQueues />}
          {(role === 'athlete' || role === 'coach') && <ParticipantOverview me={me} role={role} />}
          {role === 'judge' && <JudgeOverview />}
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <RecentNotifications role={role} />
          <Roles me={me} role={role} />
        </div>
      </div>
    </div>
  )
}
