import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import {
  duration,
  isWallRole,
  pageRoleOrder,
  pageRoleTitles,
  shortDay,
  usePerson,
  useWall,
  WallItem,
  type Person,
  type WallEntry,
  type WallRole,
} from '@/entities/person'
import { codeforcesRanks, useMe, type CodeforcesInfo, type Role } from '@/entities/session'
import { SquadBadges } from '@/entities/squad'
import { PersonReportButton } from '@/features/person-report'
import { PageSettingsModal, PostEditModal, useWallActions, type WallActions } from '@/features/person-wall'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import { formatDate, formatDateTime } from '@/shared/lib'
import {
  Avatar,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
  TextLink,
  Timeline,
  TimelineItem,
  TimelineYear,
  VerifiedMark,
} from '@/shared/ui'
import { AthleteRatings } from '@/widgets/athlete-ratings'

const STEP = 10

/** «Codeforces: handle · рейтинг 1712 · эксперт · максимум 1840» — справочно, на рейтинг ФСП не влияет */
function CodeforcesLine({ info }: { info: CodeforcesInfo }) {
  const parts =
    info.status === 'ok'
      ? [
          info.rating != null ? `рейтинг ${info.rating}` : 'без рейтинга',
          info.rank && (codeforcesRanks[info.rank] ?? info.rank),
          info.max_rating != null && `максимум ${info.max_rating}`,
        ].filter(Boolean)
      : [info.status === 'pending' ? 'рейтинг обновится в течение часа' : 'хэндл не найден на Codeforces']
  return (
    <p className="flex flex-col gap-0.5 text-body text-muted">
      <span>
        Codeforces:{' '}
        <TextLink href={info.url} className="font-mono">
          {info.handle}
        </TextLink>
        {' · '}
        {parts.join(' · ')}
      </span>
      {info.status === 'ok' && info.updated_at && (
        <span className="text-xs">обновлено {formatDateTime(info.updated_at)}</span>
      )}
    </p>
  )
}

/** Вкладки страницы: роли человека и рейтинг спортсмена */
type Tab = Role | 'rating'

const emptyTitles: Record<WallRole, string> = {
  athlete: 'Соревнований пока нет',
  coach: 'Подопечные пока не выступали',
  judge: 'Судейских назначений пока нет',
  organizer: 'Опубликованных соревнований пока нет',
}

function WallSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      {[1, 2].map((id) => (
        <div
          key={id}
          className="grid grid-cols-[4.5rem_1.5rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_2rem_minmax(0,1fr)]"
        >
          <Skeleton className="mt-4 ml-auto h-4 w-12 rounded-sm" />
          <span />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ))}
    </div>
  )
}

function PersonWall({
  person,
  role,
  canModerate,
  actions,
}: {
  person: Person
  role: WallRole
  canModerate: boolean
  actions: WallActions
}) {
  const wall = useWall(person.id, role, STEP)
  const [editing, setEditing] = useState<{ open: boolean; key: number; entry: WallEntry | null }>({
    open: false,
    key: 0,
    entry: null,
  })

  if (wall.isPending) return <WallSkeleton />
  if (wall.isError) return <ErrorState error={wall.error} onRetry={() => wall.refetch()} />
  const { items, total } = wall.data
  if (!items.length)
    return (
      <Card>
        <EmptyState
          title={emptyTitles[role]}
          action={
            person.is_owner && role !== 'organizer' ? (
              <Button to={routes.competitions} variant="secondary">
                Соревнования
              </Button>
            ) : undefined
          }
        />
      </Card>
    )

  const footer = (entry: WallEntry) => {
    if (person.is_owner)
      return (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setEditing((state) => ({ open: true, key: state.key + 1, entry }))}
        >
          {entry.post ? 'Изменить' : 'Дописать'}
        </Button>
      )
    if (canModerate && entry.post) {
      const hidden = entry.post.hidden_by_federation
      return (
        <Button
          variant="ghost"
          size="sm"
          loading={actions.moderate.isPending && actions.moderate.variables?.id === entry.post.id}
          onClick={() => actions.moderate.mutate({ id: entry.post!.id, hidden: !hidden })}
        >
          {hidden ? 'Вернуть пост' : 'Скрыть пост'}
        </Button>
      )
    }
    return undefined
  }

  return (
    <div className="flex flex-col gap-6" aria-busy={wall.isFetching}>
      <Timeline>
        {items.map((entry, index) => {
          const year = entry.contest.starts_on.slice(0, 4)
          const newYear = index === 0 || items[index - 1]!.contest.starts_on.slice(0, 4) !== year
          return [
            newYear && <TimelineYear key={`year-${year}`} year={year} />,
            <TimelineItem
              key={entry.contest.id}
              date={shortDay(entry.contest.starts_on)}
              caption={duration(entry.contest.starts_on, entry.contest.ends_on)}
              accent={entry.contest.status === 'in_progress' ? 'live' : 'primary'}
              last={index === items.length - 1}
            >
              <WallItem entry={entry} footer={footer(entry)} />
            </TimelineItem>,
          ]
        })}
      </Timeline>
      {items.length < total && (
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="secondary"
            loading={wall.isFetchingNextPage}
            onClick={() => void wall.fetchNextPage()}
          >
            Показать ещё
          </Button>
          <span className="font-mono text-sm text-muted tabular-nums">
            {items.length} из {total}
          </span>
        </div>
      )}
      {person.is_owner && (
        <PostEditModal
          key={editing.key}
          open={editing.open}
          role={role}
          entry={editing.entry}
          actions={actions}
          onClose={() => setEditing((state) => ({ ...state, open: false }))}
        />
      )}
    </div>
  )
}

/** Публичная страница человека: шапка, вкладки по ролям, лента соревнований с постами владельца */
export function PersonPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const person = usePerson(id)
  const { data: me } = useMe()
  const actions = useWallActions()
  const [settings, setSettings] = useState({ open: false, key: 0 })

  if (person.isPending)
    return (
      <div className="container-page flex max-w-4xl flex-col gap-8 py-8 sm:py-12">
        <div className="flex items-center gap-5">
          <Skeleton className="size-24 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-8 w-2/3 rounded-md" />
            <Skeleton className="h-4 w-48 max-w-full rounded-sm" />
          </div>
        </div>
        <WallSkeleton />
      </div>
    )

  if (person.isError) {
    const error = person.error instanceof ApiError ? person.error : null
    return (
      <div className="container-page py-12">
        {error && [404, 422].includes(error.status) ? (
          <EmptyState title="Страница не найдена" action={<Button to={routes.home}>На главную</Button>} />
        ) : (
          <ErrorState error={person.error} onRetry={() => person.refetch()} />
        )}
      </div>
    )
  }

  const item = person.data
  const roles = pageRoleOrder.filter((role) => item.roles.includes(role))
  const tabs: Tab[] = roles.includes('athlete') ? [...roles, 'rating'] : roles
  const tabParam = params.get('tab') as Tab | null
  const tab = tabParam && tabs.includes(tabParam) ? tabParam : tabs[0]
  const canModerate = Boolean(me?.available_roles.includes('federation'))
  const facts = [
    item.birth_date && `${formatDate(`${item.birth_date}T12:00:00Z`)} г. р.`,
    item.academic_group?.name,
  ].filter(Boolean)

  return (
    <article className="container-page flex max-w-4xl flex-col gap-8 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: 'Главная', to: routes.home }, { label: item.name }]} />

      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar name={item.name} src={item.avatar_url ?? undefined} size="xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-h1 font-medium text-balance break-words">{item.name}</h1>
          {facts.length > 0 && <p className="text-body text-muted">{facts.join(' · ')}</p>}
          <SquadBadges userId={item.id} />
          {item.codeforces && <CodeforcesLine info={item.codeforces} />}
        </div>
        <PersonReportButton userId={item.id} enabled={Boolean(me)} />
        {item.is_owner && (
          <Button
            variant="secondary"
            onClick={() => setSettings((state) => ({ open: true, key: state.key + 1 }))}
          >
            Сменить фото
          </Button>
        )}
      </header>

      {roles.length > 0 && tab && (
        <div className="flex flex-col gap-8">
          <Tabs
            aria-label="Роль"
            variant="underline"
            value={tab}
            onChange={(next) => setParams(next === tabs[0] ? {} : { tab: next }, { replace: true })}
            items={tabs.map((value) => ({
              value,
              label: value === 'rating' ? 'Рейтинг' : pageRoleTitles[value],
            }))}
          />
          {tab === 'rating' ? (
            <AthleteRatings userId={item.id} />
          ) : isWallRole(tab) ? (
            <PersonWall key={tab} person={item} role={tab} canModerate={canModerate} actions={actions} />
          ) : (
            <Card className="flex items-center gap-3">
              <VerifiedMark />
              <span className="text-body text-ink">Роль судьи подтверждена федерацией</span>
            </Card>
          )}
        </div>
      )}

      {item.is_owner && (
        <PageSettingsModal
          key={settings.key}
          open={settings.open}
          person={item}
          actions={actions}
          onClose={() => setSettings((state) => ({ ...state, open: false }))}
        />
      )}
    </article>
  )
}
