import { Link, Navigate, useSearchParams } from 'react-router'
import { useDictionaryOptions } from '@/entities/dictionary'
import {
  groupKindTitles,
  seasonCaption,
  useAthleteRatings,
  useRatingRules,
  useRatingTable,
  type RatingGroupKind,
  type RatingLine,
} from '@/entities/rating'
import { useMe } from '@/entities/session'
import { useSquad } from '@/entities/squad'
import { personAvatar } from '@/entities/person'
import { routes } from '@/shared/config'
import { cn, formatNumber, plural } from '@/shared/lib'
import {
  Avatar,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  IconSearch,
  Input,
  PageHeader,
  Pagination,
  PlaceMark,
  SearchSelect,
  Skeleton,
  Toolbar,
  type Column,
} from '@/shared/ui'

const PAGE = 50

/** Пометка у имени участника действующей сборной */
const squadMark = <span className="text-sm text-muted">сборная</span>

const starts = (count: number) => `${count} ${plural(count, ['старт', 'старта', 'стартов'])}`

/** Призёры крупно: при ничьей за третье место карточек больше трёх */
function Podium({ lines, me, squad }: { lines: RatingLine[]; me?: string; squad: Set<string> }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-3">
      {lines.map((line) => (
        <li
          key={line.athlete.id}
          className={cn(
            'grid-texture flex flex-col gap-5 card p-5 sm:p-6',
            line.place === 1 && '[--c-card-border:var(--c-primary)]',
            line.athlete.id === me && 'bg-primary-soft',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <PlaceMark place={line.place} size="lg" />
            <span className="text-right">
              <span className="block font-mono text-h2 text-ink tabular-nums">
                {formatNumber(line.points)}
              </span>
              <span className="text-sm text-muted">баллов</span>
            </span>
          </div>
          <span className="font-mono text-sm text-muted tabular-nums">{line.explain}</span>
          <div className="mt-auto flex flex-col gap-1">
            <Avatar
              name={line.athlete.full_name}
              src={personAvatar(line.athlete.id)}
              size="lg"
              className="mb-2"
            />
            <Link
              to={routes.person(line.athlete.id)}
              className="link-underline text-lead font-medium text-ink focus-visible:field-focus"
            >
              {line.athlete.full_name}
            </Link>
            <span className="text-sm text-muted">
              {[line.municipality?.name, starts(line.contests), squad.has(line.athlete.id) && 'сборная']
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

const columns = (me: string | undefined, squad: Set<string>): Column<RatingLine>[] => [
  {
    key: 'place',
    header: 'Место',
    width: 'w-24',
    cell: (line) => <PlaceMark place={line.place} size="sm" />,
  },
  {
    key: 'athlete',
    header: 'Спортсмен',
    primary: true,
    cell: (line) => (
      <span className="flex items-center gap-3">
        <span className="md:hidden">
          <PlaceMark place={line.place} size="sm" />
        </span>
        <Avatar name={line.athlete.full_name} src={personAvatar(line.athlete.id)} size="sm" />
        <Link to={routes.person(line.athlete.id)} className="link-underline focus-visible:field-focus">
          {line.athlete.full_name}
        </Link>
        {line.athlete.id === me && <span className="text-sm text-primary-text">вы</span>}
        {squad.has(line.athlete.id) && squadMark}
      </span>
    ),
  },
  {
    key: 'municipality',
    header: 'Муниципалитет',
    hideBelow: 'lg',
    cell: (line) => <span className="text-muted">{line.municipality?.name ?? '—'}</span>,
  },
  { key: 'contests', header: 'Стартов', align: 'right', width: 'w-28', cell: (line) => line.contests },
  {
    key: 'points',
    header: 'Баллы',
    align: 'right',
    width: 'w-28',
    cell: (line) => (
      <span className="flex flex-col items-end">
        <span className="text-ink">{formatNumber(line.points)}</span>
        {line.contests > 1 && (
          <span className="font-mono text-xs text-muted tabular-nums">{line.explain}</span>
        )}
      </span>
    ),
  },
]

/**
 * Полный рейтинг одной группы: призёры крупно, остальные таблицей с поиском, муниципалитетом и страницами.
 * Сюда ведёт «Весь рейтинг» из сетки. Всё состояние — в адресе.
 */
export function RatingTablePage() {
  const [params, setParams] = useSearchParams()
  const value = (key: string) => params.get(key) ?? ''
  const kind: RatingGroupKind =
    value('kind') === 'academic' || value('group_kind') === 'academic' ? 'academic' : 'age'
  const disciplineId = value('discipline_id')
  const groupId = value('group_id')
  const municipality = value('municipality_id')
  const search = value('q')
  const minRank = value('min_rank')
  const page = Math.max(1, Number(value('page')) || 1)
  const { data: me } = useMe()

  const disciplines = useDictionaryOptions('disciplines')
  const groups = useDictionaryOptions(kind === 'age' ? 'age_groups' : 'academic_groups')
  const municipalities = useDictionaryOptions('municipalities')
  const ranks = useDictionaryOptions('rank_types')
  const rules = useRatingRules()
  const mine = useAthleteRatings(me?.id)
  const target =
    disciplineId && groupId
      ? { discipline_id: Number(disciplineId), group_kind: kind, group_id: Number(groupId) }
      : null
  const squad = useSquad(target)
  const squadIds = new Set(
    [...(squad.data?.main ?? []), ...(squad.data?.reserve ?? [])].map((item) => item.athlete.id),
  )
  const disciplineName = disciplines.data?.find((item) => String(item.id) === disciplineId)?.name
  const groupName = groups.data?.find((item) => String(item.id) === groupId)?.name

  const table = useRatingTable(
    target
      ? {
          discipline_id: disciplineId,
          group_kind: kind,
          group_id: groupId,
          municipality_id: municipality || undefined,
          min_rank_id: minRank || undefined,
          search: search.trim() || undefined,
        }
      : null,
    PAGE,
    (page - 1) * PAGE,
  )
  const lines = table.data?.items ?? []
  const total = table.data?.total ?? 0
  const showPodium = page === 1 && !search.trim()
  const podium = showPodium ? lines.filter((line) => line.place <= 3) : []
  const rest = showPodium ? lines.slice(podium.length) : lines
  const you = (mine.data ?? []).find(
    (item) =>
      item.group_kind === kind &&
      String(item.discipline.id) === disciplineId &&
      String(item.group.id) === groupId,
  )

  const update = (changes: Record<string, string>) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        for (const [key, next] of Object.entries(changes)) {
          if (next) copy.set(key, next)
          else copy.delete(key)
        }
        if (!('page' in changes)) copy.delete('page')
        return copy
      },
      { replace: true },
    )

  if (!target) return <Navigate to={routes.ratings} replace />
  const back = `${routes.ratings}?${new URLSearchParams({ discipline_id: disciplineId, ...(kind === 'academic' ? { kind } : {}) })}`

  return (
    <div className="container-page flex flex-col gap-6 py-8 sm:py-12">
      <PageHeader
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Рейтинг', to: back },
          { label: groupName ?? 'Группа' },
        ]}
        title={groupName ?? 'Рейтинг группы'}
        description={[disciplineName, groupKindTitles[kind], seasonCaption(rules.data)]
          .filter(Boolean)
          .join(' · ')}
      />

      <Toolbar
        search={
          <Field label="Поиск по ФИО">
            <Input
              type="search"
              maxLength={100}
              leftIcon={<IconSearch size={18} />}
              value={search}
              onChange={(event) => update({ q: event.target.value })}
            />
          </Field>
        }
      >
        <Field label="Муниципалитет">
          <SearchSelect
            value={municipality}
            disabled={municipalities.isPending}
            onChange={(next) => update({ municipality_id: next })}
            options={[
              { value: '', label: 'Вся область' },
              ...(municipalities.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        </Field>
        <Field label="Разряд не ниже">
          <SearchSelect
            value={minRank}
            disabled={ranks.isPending}
            onChange={(next) => update({ min_rank: next })}
            options={[
              { value: '', label: 'Любой, и без разряда' },
              ...(ranks.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        </Field>
      </Toolbar>

      {you && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-primary bg-primary-soft px-5 py-4">
          <PlaceMark place={you.place} />
          <span className="flex-1 text-body text-ink">
            Вы — {you.place} место из {you.total}
          </span>
          <span className="font-mono text-body text-ink tabular-nums">
            {formatNumber(you.points)} баллов · {you.explain}
          </span>
        </div>
      )}

      {table.isPending ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((id) => (
              <Skeleton key={id} className="h-52 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-lg" />
        </div>
      ) : table.isError ? (
        <ErrorState error={table.error} onRetry={() => void table.refetch()} />
      ) : !lines.length && !search.trim() ? (
        <div className="card">
          <EmptyState
            title={minRank ? 'Нет спортсменов с таким разрядом' : 'В этой группе пока нет мест'}
            action={
              minRank ? (
                <Button variant="secondary" onClick={() => update({ min_rank: '' })}>
                  Любой разряд
                </Button>
              ) : municipality ? (
                <Button variant="secondary" onClick={() => update({ municipality_id: '' })}>
                  Вся область
                </Button>
              ) : (
                <Button variant="secondary" to={back}>
                  Все группы
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6" aria-busy={table.isFetching}>
          {podium.length > 0 && <Podium lines={podium} me={me?.id} squad={squadIds} />}
          {(rest.length > 0 || search.trim()) && (
            <DataTable
              caption="Рейтинг группы"
              columns={columns(me?.id, squadIds)}
              rows={rest}
              rowKey={(line) => line.athlete.id}
              highlight={(line) => line.athlete.id === me?.id}
              empty={<EmptyState title="Никого не нашли" description="Проверьте ФИО" />}
            />
          )}
          <div className="flex flex-col items-center gap-2">
            <Pagination
              page={page}
              totalPages={Math.ceil(total / PAGE)}
              onPage={(next) => update({ page: next > 1 ? String(next) : '' })}
            />
            <span className="font-mono text-sm text-muted tabular-nums">
              {total} {plural(total, ['спортсмен', 'спортсмена', 'спортсменов'])}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
