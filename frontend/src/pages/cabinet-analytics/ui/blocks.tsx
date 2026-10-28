import type { UseQueryResult } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  analyticsApi,
  useAnalytics,
  type AnalyticsBlock,
  type AnalyticsQuery,
  type CoachRow,
  type Delta,
  type DisciplineRow,
  type JudgeRow,
  type NamedCount,
  type RetentionData,
} from '@/entities/analytics'
import { personAvatar } from '@/entities/person'
import { routes } from '@/shared/config'
import { cn, formatNumber } from '@/shared/lib'
import {
  Avatar,
  BarList,
  Button,
  ColumnChart,
  DataTable,
  DeltaMark,
  EmptyState,
  ErrorState,
  IconDownload,
  PlaceMark,
  SectionHeader,
  Skeleton,
  StatTile,
  Tabs,
  type Column,
} from '@/shared/ui'

interface BlockProps {
  query: AnalyticsQuery
}

/** Блок дашборда: заголовок, своя выгрузка листом xlsx справа и содержимое */
function Section({
  title,
  description,
  block,
  query,
  children,
}: {
  title: string
  description?: string
  block: AnalyticsBlock
  query: AnalyticsQuery
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <SectionHeader
        title={title}
        description={description}
        action={
          <Button
            href={analyticsApi.xlsxUrl(query, block)}
            variant="secondary"
            size="sm"
            leftIcon={<IconDownload size={16} />}
          >
            xlsx
          </Button>
        }
      />
      {children}
    </section>
  )
}

/** Четыре состояния блока: загрузка той же формы, ошибка с повтором, пусто и данные */
function Frame<T>({
  result,
  skeleton,
  empty,
  children,
}: {
  result: UseQueryResult<T>
  skeleton: ReactNode
  empty?: (data: T) => boolean
  children: (data: T) => ReactNode
}) {
  if (result.isPending) return skeleton
  if (result.isError && !result.data)
    return <ErrorState error={result.error} onRetry={() => void result.refetch()} />
  const data = result.data as T
  if (empty?.(data))
    return (
      <div className="card">
        <EmptyState title="За этот период пусто" description="Выберите период длиннее или снимите фильтры" />
      </div>
    )
  return (
    <div
      aria-busy={result.isFetching}
      className={cn('min-w-0 transition-opacity duration-200', result.isPlaceholderData && 'opacity-60')}
    >
      {children(data)}
    </div>
  )
}

/** Число с изменением в строке: итоги под графиком */
function Total({
  label,
  delta,
  unit,
  inverse,
}: {
  label: string
  delta: Delta
  unit?: string
  inverse?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="font-mono text-h3 text-ink tabular-nums">
          {formatNumber(delta.value)}
          {unit}
        </span>
        <DeltaMark
          diff={delta.diff}
          pct={unit ? null : delta.pct}
          unit={unit && ' п. п.'}
          inverse={inverse}
        />
      </dd>
    </div>
  )
}

/** Изменение по двум числам: для строк, где бэк отдаёт текущее и прошлое */
const change = (value: number, previous: number): Delta => ({
  value,
  previous,
  diff: value - previous,
  pct: previous ? Math.round(((value - previous) / previous) * 1000) / 10 : null,
})

const bars = (items: NamedCount[]) => items.map((item) => ({ label: item.name, value: item.value }))

const card = 'card p-4 sm:p-6'
const chartSkeleton = <Skeleton className="h-80 rounded-lg" />
const tableSkeleton = <Skeleton className="h-72 rounded-lg" />

/** Итоги под графиком: на телефоне по два в ряд */
function Totals({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-4 border-t border-line-soft pt-4 sm:grid-cols-3">{children}</dl>
}

/** Сводка: главные числа периода плитками */
export function SummaryBlock({ query }: BlockProps) {
  const result = useAnalytics('summary', query)
  return (
    <Frame
      result={result}
      skeleton={
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
      }
    >
      {({ tiles }) => (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {(
            [
              ['participants', 'Участники'],
              ['newcomers', 'Новички'],
              ['starts', 'Участия'],
              ['contests', 'Соревнования'],
            ] as const
          ).map(([key, label]) => (
            <StatTile
              key={key}
              label={label}
              value={tiles[key].value}
              delta={tiles[key].diff}
              deltaPct={tiles[key].pct}
            />
          ))}
          <StatTile
            label="Одобрено заявок"
            value={tiles.approval_rate.value}
            unit="%"
            delta={tiles.approval_rate.diff}
            deltaUnit=" п. п."
          />
          <StatTile
            label="Удержание"
            value={tiles.retention.value}
            unit="%"
            delta={tiles.retention.diff}
            deltaUnit=" п. п."
          />
          <StatTile
            label="Разряды и категории"
            className="col-span-2 sm:col-span-1"
            value={tiles.qualifications.value}
            delta={tiles.qualifications.diff}
            deltaPct={tiles.qualifications.pct}
          />
        </div>
      )}
    </Frame>
  )
}

type ParticipantSeries = 'participants' | 'newcomers' | 'starts'

export function ParticipantsBlock({ query }: BlockProps) {
  const result = useAnalytics('participants', query)
  const [series, setSeries] = useState<ParticipantSeries>('participants')
  return (
    <Section
      title="Участники и новички"
      description="По одобренным заявкам, месяц — по началу соревнования"
      block="participants"
      query={query}
    >
      <Frame result={result} skeleton={chartSkeleton} empty={(data) => !data.totals.starts.value}>
        {(data) => (
          <div className={cn(card, 'flex flex-col gap-5')}>
            <Tabs
              aria-label="Что показать"
              className="self-stretch sm:self-start"
              fullWidth
              value={series}
              onChange={setSeries}
              items={[
                { value: 'participants', label: 'Участники' },
                { value: 'newcomers', label: 'Новички' },
                { value: 'starts', label: 'Участия' },
              ]}
            />
            <ColumnChart
              data={data.months.map((month) => ({ label: month.label, value: month[series] }))}
              highlight={data.months.length - 1}
            />
            <Totals>
              <Total label="Участники" delta={data.totals.participants} />
              <Total label="Новички" delta={data.totals.newcomers} />
              <Total label="Участия" delta={data.totals.starts} />
            </Totals>
          </div>
        )}
      </Frame>
    </Section>
  )
}

function CountList({ title, items }: { title: string; items: NamedCount[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h3 className="text-body font-medium text-ink">{title}</h3>
      {items.length ? <BarList data={bars(items)} /> : <p className="text-sm text-muted">Нет данных</p>}
    </div>
  )
}

export function ContestsBlock({ query }: BlockProps) {
  const result = useAnalytics('contests', query)
  return (
    <Section title="Соревнования" block="contests" query={query}>
      <Frame
        result={result}
        skeleton={chartSkeleton}
        empty={(data) => !data.total.value && !data.total.previous}
      >
        {(data) => (
          <div className={cn(card, 'flex flex-col gap-6')}>
            <dl>
              <Total label="Всего" delta={data.total} />
            </dl>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-8">
              <CountList title="Уровень" items={data.levels} />
              <CountList title="Формат" items={data.formats} />
              <CountList title="Статус" items={data.statuses} />
            </div>
          </div>
        )}
      </Frame>
    </Section>
  )
}

export function ApplicationsBlock({ query }: BlockProps) {
  const result = useAnalytics('applications', query)
  return (
    <Section title="Заявки" block="applications" query={query}>
      <Frame
        result={result}
        skeleton={chartSkeleton}
        empty={(data) => Object.values(data.counts).every((item) => !item.value && !item.previous)}
      >
        {({ counts, reasons }) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={cn(card, 'flex flex-col gap-5')}>
              <dl className="grid grid-cols-2 gap-4">
                <Total label="Одобрено" delta={counts.approved} />
                <Total label="Отклонено" delta={counts.rejected} inverse />
                <Total label="На рассмотрении" delta={counts.submitted} />
                <Total label="Отозвано" delta={counts.withdrawn} inverse />
              </dl>
            </div>
            <div className={cn(card, 'flex flex-col gap-4')}>
              <h3 className="text-body font-medium text-ink">Частые причины отказа</h3>
              {reasons.length ? (
                <BarList data={reasons.map((item) => ({ label: item.reason, value: item.count }))} />
              ) : (
                <p className="text-sm text-muted">Отказов не было</p>
              )}
            </div>
          </div>
        )}
      </Frame>
    </Section>
  )
}

type Cohort = RetentionData['cohorts'][number]

const cohortColumns: Column<Cohort>[] = [
  { key: 'month', header: 'Первое участие', primary: true, cell: (row) => row.label },
  { key: 'size', header: 'Новичков', align: 'right', cell: (row) => formatNumber(row.size) },
  ...([1, 3, 6] as const).map((months): Column<Cohort> => ({
    key: `m${months}`,
    header: `Вернулись за ${months} мес.`,
    align: 'right',
    cell: (row) => <span className="text-ink">{formatNumber(row[`m${months}`])}%</span>,
  })),
]

export function RetentionBlock({ query }: BlockProps) {
  const result = useAnalytics('retention', query)
  return (
    <Section title="Удержание" block="retention" query={query}>
      <Frame result={result} skeleton={tableSkeleton} empty={(data) => !data.base && !data.cohorts.length}>
        {(data) => (
          <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <StatTile
              label="Удержание"
              value={data.rate.value}
              unit="%"
              delta={data.rate.diff}
              deltaUnit=" п. п."
              hint={`${formatNumber(data.kept)} из ${formatNumber(data.base)} участников прошлого периода`}
            />
            <DataTable
              caption="Когорты по месяцу первого участия"
              columns={cohortColumns}
              rows={data.cohorts}
              rowKey={(row) => row.month}
              empty={<EmptyState title="Новичков в периоде нет" />}
            />
          </div>
        )}
      </Frame>
    </Section>
  )
}

export function DemographicsBlock({ query }: BlockProps) {
  const result = useAnalytics('demographics', query)
  return (
    <Section title="Возраст и муниципалитеты" block="demographics" query={query}>
      <Frame result={result} skeleton={chartSkeleton} empty={(data) => !data.municipalities.length}>
        {(data) => (
          <div className={cn(card, 'grid gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-8')}>
            <CountList title="Муниципалитеты" items={data.municipalities} />
            <CountList title="Возрастные группы" items={data.ages} />
            <CountList title="Академические группы" items={data.academic} />
          </div>
        )}
      </Frame>
    </Section>
  )
}

const coachColumns: Column<CoachRow & { place: number }>[] = [
  { key: 'place', header: 'Место', width: 'w-20', cell: (row) => <PlaceMark place={row.place} size="sm" /> },
  {
    key: 'name',
    header: 'Тренер',
    primary: true,
    cell: (row) => (
      <span className="flex min-w-0 items-center gap-3">
        <Avatar name={row.name} src={personAvatar(row.id)} size="sm" />
        <Link to={routes.person(row.id)} className="truncate link-underline focus-visible:field-focus">
          {row.name}
        </Link>
      </span>
    ),
  },
  {
    key: 'points',
    header: 'Баллы подопечных',
    align: 'right',
    cell: (row) => {
      const delta = change(row.points, row.previous_points)
      return (
        <span className="flex flex-wrap items-baseline justify-end gap-x-2">
          <span className="text-ink">{formatNumber(row.points)}</span>
          <DeltaMark diff={delta.diff} pct={delta.pct} compact className="text-xs" />
        </span>
      )
    },
  },
  { key: 'athletes', header: 'Подопечные', align: 'right', hideBelow: 'lg', cell: (row) => row.athletes },
  { key: 'starts', header: 'Участия', align: 'right', hideBelow: 'lg', cell: (row) => row.starts },
  { key: 'podiums', header: 'Призовые', align: 'right', cell: (row) => row.podiums },
]

export function CoachesBlock({ query }: BlockProps) {
  const result = useAnalytics('coaches', query)
  return (
    <Section
      title="Лучшие тренеры"
      description="По баллам спортсменов из заявок тренера"
      block="coaches"
      query={query}
    >
      <Frame result={result} skeleton={tableSkeleton} empty={(data) => !data.items.length}>
        {(data) => (
          <DataTable
            caption="Лучшие тренеры"
            columns={coachColumns}
            rows={data.items.map((row, index) => ({ ...row, place: index + 1 }))}
            rowKey={(row) => row.id}
          />
        )}
      </Frame>
    </Section>
  )
}

const judgeColumns: Column<JudgeRow>[] = [
  {
    key: 'name',
    header: 'Судья',
    primary: true,
    cell: (row) => (
      <span className="flex min-w-0 items-center gap-3">
        <Avatar name={row.name} src={personAvatar(row.id)} size="sm" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <Link to={routes.person(row.id)} className="truncate link-underline focus-visible:field-focus">
            {row.name}
          </Link>
          <span className="text-xs text-muted">{row.category ?? 'Без категории'}</span>
        </span>
      </span>
    ),
  },
  { key: 'contests', header: 'Соревнований', align: 'right', cell: (row) => row.contests },
  { key: 'days', header: 'Дней', align: 'right', cell: (row) => row.days },
  { key: 'chief', header: 'Главным судьёй', align: 'right', cell: (row) => row.chief },
]

export function JudgesBlock({ query }: BlockProps) {
  const result = useAnalytics('judges', query)
  return (
    <Section title="Нагрузка на судей" block="judges" query={query}>
      <Frame
        result={result}
        skeleton={tableSkeleton}
        empty={(data) => !data.items.length && !data.without_panel.value}
      >
        {(data) => (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <StatTile
                label="Судей работало"
                value={data.judges.value}
                delta={data.judges.diff}
                deltaPct={data.judges.pct}
              />
              <StatTile
                label="Судей на соревнование"
                value={data.average.value}
                delta={data.average.diff}
                deltaPct={data.average.pct}
              />
              <StatTile
                label="Без коллегии"
                value={data.without_panel.value}
                delta={data.without_panel.diff}
                deltaPct={data.without_panel.pct}
                inverse
                className="col-span-2 sm:col-span-1"
              />
            </div>
            <DataTable
              caption="Нагрузка на судей"
              columns={judgeColumns}
              rows={data.items}
              rowKey={(row) => row.id}
              empty={<EmptyState title="Назначений в периоде нет" />}
            />
          </div>
        )}
      </Frame>
    </Section>
  )
}

export function QualificationsBlock({ query }: BlockProps) {
  const result = useAnalytics('qualifications', query)
  const [series, setSeries] = useState<'ranks' | 'categories'>('ranks')
  return (
    <Section title="Разряды и категории" block="qualifications" query={query}>
      <Frame
        result={result}
        skeleton={chartSkeleton}
        empty={(data) => !data.totals.ranks.value && !data.totals.categories.value && !data.by_name.length}
      >
        {(data) => (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className={cn(card, 'flex flex-col gap-5')}>
              <Tabs
                aria-label="Что показать"
                className="self-stretch sm:self-start"
                fullWidth
                value={series}
                onChange={setSeries}
                items={[
                  { value: 'ranks', label: 'Разряды' },
                  { value: 'categories', label: 'Категории судей' },
                ]}
              />
              <ColumnChart
                data={data.months.map((month) => ({ label: month.label, value: month[series] }))}
                highlight={data.months.length - 1}
              />
              <dl className="grid grid-cols-2 gap-4 border-t border-line-soft pt-4">
                <Total label="Разряды" delta={data.totals.ranks} />
                <Total label="Категории судей" delta={data.totals.categories} />
              </dl>
            </div>
            <div className={cn(card, 'flex flex-col gap-4')}>
              <h3 className="text-body font-medium text-ink">По видам</h3>
              {data.by_name.length ? (
                <BarList data={data.by_name.map((item) => ({ label: item.name, value: item.value }))} />
              ) : (
                <p className="text-sm text-muted">В периоде ничего не присвоено</p>
              )}
            </div>
          </div>
        )}
      </Frame>
    </Section>
  )
}

const deltaCell = (key: Exclude<keyof DisciplineRow, 'id' | 'name'>) => (row: DisciplineRow) => (
  <span className="flex flex-wrap items-baseline justify-end gap-x-2">
    <span className="text-ink">{formatNumber(row[key].value)}</span>
    <DeltaMark diff={row[key].diff} pct={row[key].pct} compact className="text-xs" />
  </span>
)

const disciplineColumns: Column<DisciplineRow>[] = [
  { key: 'name', header: 'Дисциплина', primary: true, cell: (row) => row.name },
  { key: 'participants', header: 'Участники', align: 'right', cell: deltaCell('participants') },
  { key: 'newcomers', header: 'Новички', align: 'right', cell: deltaCell('newcomers') },
  { key: 'contests', header: 'Соревнования', align: 'right', hideBelow: 'lg', cell: deltaCell('contests') },
  {
    key: 'approved',
    header: 'Одобрено заявок',
    align: 'right',
    hideBelow: 'xl',
    cell: deltaCell('approved'),
  },
  { key: 'points', header: 'Баллы', align: 'right', hideBelow: 'lg', cell: deltaCell('points') },
]

export function DisciplinesBlock({ query }: BlockProps) {
  const result = useAnalytics('disciplines', query)
  return (
    <Section
      title="По дисциплинам"
      description="Новичок — впервые выступил в этой дисциплине"
      block="disciplines"
      query={query}
    >
      <Frame result={result} skeleton={tableSkeleton} empty={(data) => !data.items.length}>
        {(data) => (
          <DataTable
            caption="По дисциплинам"
            columns={disciplineColumns}
            rows={data.items}
            rowKey={(row) => row.id}
          />
        )}
      </Frame>
    </Section>
  )
}
