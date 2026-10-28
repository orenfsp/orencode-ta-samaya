import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import { useDictionaryOptions } from '@/entities/dictionary'
import { DisciplineNav } from '@/entities/discipline'
import { personAvatar } from '@/entities/person'
import {
  groupKindTitles,
  seasonCaption,
  useAthleteRatings,
  useRatingBoards,
  useRatingRules,
  type RatingBoard,
  type RatingGroupKind,
} from '@/entities/rating'
import { useMe } from '@/entities/session'
import { useSquads } from '@/entities/squad'
import { RatingRulesCard } from '@/features/rating-rules'
import { routes } from '@/shared/config'
import { formatNumber } from '@/shared/lib'
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  PlaceMark,
  RankingList,
  SearchSelect,
  Skeleton,
  Tabs,
} from '@/shared/ui'

/** Сколько строк в карточке группы: трое крупно, ещё семь тонко */
const TOP = 10

/** Ссылка на полный рейтинг группы */
const tableLink = (board: RatingBoard, minRank: string) =>
  `${routes.ratingTable}?${new URLSearchParams({
    discipline_id: String(board.discipline.id),
    group_id: String(board.group.id),
    ...(board.group_kind === 'academic' ? { kind: 'academic' } : {}),
    ...(minRank ? { min_rank: minRank } : {}),
  })}`

function Board({ board, squad, minRank }: { board: RatingBoard; squad: Set<string>; minRank: string }) {
  return (
    <section className="flex h-full min-w-0 flex-col gap-3">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="truncate text-h3 font-medium">{board.group.name}</h2>
        <Link
          to={tableLink(board, minRank)}
          className="shrink-0 link-underline font-mono text-sm text-muted tabular-nums hover:text-ink focus-visible:field-focus"
        >
          Все {board.total}
        </Link>
      </header>
      <RankingList
        className="flex-1"
        topCount={3}
        restCount={TOP - 3}
        rows={board.items.map((line) => ({
          id: line.athlete.id,
          place: line.place,
          name: line.athlete.full_name,
          avatar: personAvatar(line.athlete.id),
          to: routes.person(line.athlete.id),
          points: line.points,
          meta: [line.explain, line.municipality?.name, squad.has(line.athlete.id) && 'сборная']
            .filter(Boolean)
            .join(' · '),
        }))}
      />
    </section>
  )
}

/**
 * Рейтинг спортсменов: дисциплина и принцип групп (возраст или учёба), все группы сразу сеткой.
 * В карточке группы — первые десять, полный рейтинг с поиском — по ссылке. Состояние — в адресе.
 */
export function RatingsPage() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const value = (key: string) => params.get(key) ?? ''
  const kind: RatingGroupKind = value('kind') === 'academic' ? 'academic' : 'age'
  const minRank = value('min_rank')
  const { data: me } = useMe()
  const rules = useRatingRules()
  const disciplines = useDictionaryOptions('disciplines')
  const ranks = useDictionaryOptions('rank_types')
  const mine = useAthleteRatings(me?.id)
  const own = (mine.data ?? []).filter((item) => item.group_kind === kind)
  const disciplineId =
    value('discipline_id') ||
    (own[0] ? String(own[0].discipline.id) : '') ||
    (disciplines.data?.[0] ? String(disciplines.data[0].id) : '')

  const boards = useRatingBoards(
    { discipline_id: disciplineId || undefined, group_kind: kind, min_rank_id: minRank || undefined },
    TOP,
  )
  const squads = useSquads({ discipline_id: Number(disciplineId) || undefined, group_kind: kind })
  const squadIds = new Set(
    (squads.data ?? []).flatMap((squad) => [...squad.main, ...squad.reserve].map((item) => item.athlete.id)),
  )
  const items = (boards.data ?? []).filter((board) => board.total > 0)
  const you = own.find((item) => String(item.discipline.id) === disciplineId)

  // Старые ссылки на одну группу и на сборную ведут на свои страницы
  if (value('group_id'))
    return (
      <Navigate
        to={`${value('view') === 'squad' ? routes.squads : routes.ratingTable}${location.search}`}
        replace
      />
    )

  const update = (changes: Record<string, string>) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        for (const [key, next] of Object.entries(changes)) {
          if (next) copy.set(key, next)
          else copy.delete(key)
        }
        return copy
      },
      { replace: true },
    )

  return (
    <div className="container-page flex flex-col gap-6 py-8 sm:py-12">
      <PageHeader
        crumbs={[{ label: 'Главная', to: routes.home }, { label: 'Рейтинг спортсменов' }]}
        title="Рейтинг спортсменов"
        description={`Места в верифицированных соревнованиях: ${seasonCaption(rules.data)}. Спортсмен стоит в своей текущей группе`}
      />

      <RatingRulesCard />

      <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
        {disciplines.data && disciplineId ? (
          <DisciplineNav
            className="lg:sticky lg:top-6"
            items={disciplines.data}
            value={disciplineId}
            onChange={(next) => update({ discipline_id: next })}
          />
        ) : (
          <Skeleton className="h-11 rounded-md lg:h-96" />
        )}
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:w-auto">
              <Tabs
                aria-label="Группы"
                fullWidth
                value={kind}
                onChange={(next) => update({ kind: next === 'academic' ? next : '' })}
                items={[
                  { value: 'age', label: groupKindTitles.age },
                  { value: 'academic', label: groupKindTitles.academic },
                ]}
              />
            </div>
            <Field label="Разряд не ниже" className="w-full sm:w-72">
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
          </div>

          {you && (
            <Link
              to={`${routes.ratingTable}?${new URLSearchParams({
                discipline_id: disciplineId,
                group_id: String(you.group.id),
                ...(kind === 'academic' ? { kind } : {}),
              })}`}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-primary bg-primary-soft px-5 py-4 transition-colors hover:bg-primary-soft/70 focus-visible:field-focus"
            >
              <PlaceMark place={you.place} />
              <span className="flex-1 text-body text-ink">
                Вы — {you.place} место из {you.total} · {you.group.name}
              </span>
              <span className="font-mono text-body text-ink tabular-nums">
                {formatNumber(you.points)} баллов
              </span>
            </Link>
          )}

          {boards.isPending || disciplines.isPending ? (
            <div className="grid gap-x-6 gap-y-10 md:grid-cols-2">
              {[1, 2, 3, 4].map((id) => (
                <Skeleton key={id} className="h-[34rem] rounded-lg" />
              ))}
            </div>
          ) : boards.isError ? (
            <ErrorState error={boards.error} onRetry={() => void boards.refetch()} />
          ) : !items.length ? (
            <div className="card">
              <EmptyState
                title={minRank ? 'Нет спортсменов с таким разрядом' : 'В этой дисциплине пока нет мест'}
                description={
                  minRank
                    ? 'Снимите фильтр по разряду или выберите ступень ниже'
                    : 'Рейтинг появится, когда в верифицированных соревнованиях внесут места'
                }
                action={
                  minRank ? (
                    <Button variant="secondary" onClick={() => update({ min_rank: '' })}>
                      Любой разряд
                    </Button>
                  ) : (
                    <Button variant="secondary" to={routes.competitions}>
                      Соревнования
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="grid gap-x-6 gap-y-10 md:grid-cols-2" aria-busy={boards.isFetching}>
              {items.map((board) => (
                <Board key={board.group.id} board={board} squad={squadIds} minRank={minRank} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
