import { Link } from 'react-router'
import type { EvskCandidate } from '@/entities/evsk'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import { DataTable, EmptyState, MetaTag, PlaceMark, type Column } from '@/shared/ui'

const columns: Column<EvskCandidate>[] = [
  {
    key: 'place',
    header: 'Место',
    width: 'w-16',
    cell: (item) => <PlaceMark place={item.place} size="sm" />,
  },
  {
    key: 'name',
    header: 'Спортсмен',
    primary: true,
    cell: (item) => (
      <Link
        to={routes.person(item.user_id)}
        className="link-underline text-ink"
        onClick={(event) => event.stopPropagation()}
      >
        {item.name}
      </Link>
    ),
  },
  {
    key: 'rank',
    header: 'Может претендовать',
    cell: (item) => (
      <span className="flex flex-col gap-0.5">
        <span>{item.rank}</span>
        {item.current && <span className="text-xs text-muted">сейчас: {item.current}</span>}
        {item.rule_demo && <MetaTag className="w-fit">Демо-норма</MetaTag>}
      </span>
    ),
  },
  {
    key: 'contest',
    header: 'Соревнование',
    hideBelow: 'lg',
    cell: (item) => (
      <span className="flex flex-col">
        <Link
          to={routes.competition(item.contest_id)}
          className="link-underline text-ink"
          onClick={(event) => event.stopPropagation()}
        >
          {item.contest_title}
        </Link>
        <span className="font-mono text-xs text-muted tabular-nums">{formatDate(item.ends_on)}</span>
      </span>
    ),
  },
]

/** Результаты протоколов, которые могут соответствовать разряду ЕВСК: подсказка, а не решение */
export function EvskCandidates({ items, loading }: { items: EvskCandidate[]; loading?: boolean }) {
  return (
    <DataTable
      caption="Кандидаты на разряд по ЕВСК"
      columns={columns}
      rows={items}
      rowKey={(item) => `${item.result_id}-${item.rank_type_id}`}
      loading={loading}
      empty={
        <EmptyState
          title="Кандидатов нет"
          description="Появятся, когда места в протоколах совпадут с нормами ЕВСК"
        />
      }
    />
  )
}
