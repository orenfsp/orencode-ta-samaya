import type { ReactNode } from 'react'
import { cn, formatNumber } from '@/shared/lib'

/*
 * Графики для аналитики кабинетов. Палитра бренда — два хроматических цвета (синий, красный),
 * поэтому: величины — одним синим; доли — до 4 тонов, и всегда с подписанной легендой и числами,
 * чтобы смысл не держался на цвете. Подсказка по наведению — data-tooltip (TooltipLayer),
 * для скринридера рядом скрытая таблица. Метки и числа — цветом текста, не цветом серии.
 */

/**
 * Изменение к прошлому периоду: «▲ 16 · +76%». Стрелка и знак несут смысл без цвета.
 * pct = null — в прошлом периоде был ноль, процента нет. inverse — рост плох (отказы).
 */
export function DeltaMark({
  diff,
  pct,
  unit = '',
  inverse,
  compact,
  className,
}: {
  diff: number
  pct?: number | null
  /** В ячейке таблицы: только стрелка и процент (или разница, если процента нет) */
  compact?: boolean
  /** Единица разницы: « п. п.» у долей в процентах */
  unit?: string
  inverse?: boolean
  className?: string
}) {
  if (diff === 0)
    return (
      <span className={cn('font-mono text-sm text-muted', className)}>{compact ? '—' : 'без изменений'}</span>
    )
  const up = diff > 0
  const good = up !== Boolean(inverse)
  const value = formatNumber(Math.abs(diff))
  const label = `${up ? 'Рост' : 'Снижение'} на ${value}${unit}${pct != null ? `, ${formatNumber(Math.abs(pct))}%` : ''}`
  return (
    <span
      aria-label={label}
      className={cn(
        'inline-flex items-baseline gap-1 font-mono text-sm whitespace-nowrap tabular-nums',
        good ? 'text-primary-text' : 'text-live-text',
        className,
      )}
    >
      <span aria-hidden="true">
        {compact ? (
          <>
            {up ? '▲' : '▼'} {pct != null ? `${formatNumber(Math.abs(pct))}%` : `${value}${unit}`}
          </>
        ) : (
          <>
            {up ? '▲' : '▼'} {value}
            {unit}
            {pct != null && (
              <span className="text-muted">
                {' · '}
                {up ? '+' : '−'}
                {formatNumber(Math.abs(pct))}%
              </span>
            )}
          </>
        )}
      </span>
    </span>
  )
}

/** Одно число с подписью: «Соревнований за год». delta — изменение к прошлому периоду, deltaPct — оно же в процентах */
export function StatTile({
  label,
  value,
  unit = '',
  delta,
  deltaPct,
  deltaUnit,
  inverse,
  hint,
  className,
}: {
  label: string
  value: number | string
  /** Единица у значения: «%» */
  unit?: string
  delta?: number
  deltaPct?: number | null
  deltaUnit?: string
  inverse?: boolean
  hint?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('flex min-w-0 flex-col gap-2 rounded-lg border border-line-soft p-4 sm:p-5', className)}
    >
      <span className="text-sm text-muted">{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-h2 text-ink tabular-nums">
          {typeof value === 'number' ? formatNumber(value) : value}
          {unit}
        </span>
        {delta != null && <DeltaMark diff={delta} pct={deltaPct} unit={deltaUnit} inverse={inverse} />}
      </span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  )
}

export interface ChartDatum {
  label: string
  value: number
}

/** Горизонтальные полосы с подписями: распределение по дисциплинам, группам, муниципалитетам */
export function BarList({
  data,
  unit = '',
  highlight,
  className,
}: {
  data: ChartDatum[]
  unit?: string
  /** Подпись строки, которую выделить синим; остальные — приглушённые */
  highlight?: string
  className?: string
}) {
  const max = Math.max(1, ...data.map((item) => item.value))
  return (
    <figure className={cn('flex flex-col gap-2.5', className)}>
      <ul className="flex flex-col gap-2.5" aria-hidden="true">
        {data.map((item, index) => (
          <li
            key={item.label}
            data-tooltip={`${item.label}: ${formatNumber(item.value)}${unit}`}
            className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm"
          >
            <span className="truncate text-ink">{item.label}</span>
            <span className="h-2.5 overflow-hidden rounded-r-xs bg-surface-3">
              <span
                style={{ width: `${(item.value / max) * 100}%`, animationDelay: `${index * 40}ms` }}
                className={cn(
                  'block h-full origin-left animate-grow rounded-r-xs',
                  !highlight || highlight === item.label ? 'bg-primary' : 'bg-line',
                )}
              />
            </span>
            <span className="font-mono text-muted tabular-nums">
              {formatNumber(item.value)}
              {unit}
            </span>
          </li>
        ))}
      </ul>
      <DataTable data={data} unit={unit} />
    </figure>
  )
}

/** Столбики по времени: участия по месяцам, соревнования по годам. Одна ось, одна серия */
export function ColumnChart({
  data,
  unit = '',
  height = 180,
  highlight,
  className,
}: {
  data: ChartDatum[]
  unit?: string
  height?: number
  /** Индекс столбика, который выделить (например, текущий месяц) */
  highlight?: number
  className?: string
}) {
  const max = Math.max(1, ...data.map((item) => item.value))
  const ticks = [max, Math.round(max / 2), 0]
  return (
    <figure className={cn('flex min-w-0 flex-col gap-2', className)}>
      {/* Много столбиков на узком экране — прокрутка внутри графика, а не всей страницы */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1" aria-hidden="true">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3" style={{ minWidth: data.length * 56 }}>
          <div
            className="flex flex-col justify-between text-right font-mono text-xs text-muted"
            style={{ height }}
          >
            {ticks.map((tick, index) => (
              <span key={index} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
                {formatNumber(tick)}
              </span>
            ))}
          </div>
          <div className="relative flex items-end gap-0.5" style={{ height }}>
            {/* Сетка — едва заметная, данные важнее */}
            <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-line-soft" />
            <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-line-soft" />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-line" />
            {data.map((item, index) => (
              <span
                key={item.label}
                data-tooltip={`${item.label}: ${formatNumber(item.value)}${unit}`}
                className="group relative flex h-full flex-1 items-end justify-center"
              >
                <span
                  style={{ height: `${(item.value / max) * 100}%`, animationDelay: `${index * 30}ms` }}
                  className={cn(
                    'w-full max-w-10 origin-bottom animate-grow-up rounded-t-xs transition-colors duration-150',
                    highlight == null || highlight === index ? 'bg-primary' : 'bg-primary/45',
                    'group-hover:bg-primary-hover',
                  )}
                />
              </span>
            ))}
          </div>
          <span />
          <div className="flex gap-0.5 pt-1.5">
            {data.map((item, index) => (
              <span
                key={item.label}
                className={cn(
                  'flex-1 truncate text-center font-mono text-xs text-muted',
                  // Подписи через одну, когда столбиков много — чтобы не налезали
                  data.length > 12 && index % 2 === 1 && 'invisible',
                )}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <DataTable data={data} unit={unit} />
    </figure>
  )
}

export type ShareTone = 'primary' | 'live' | 'ink' | 'muted'
const shareTones: Record<ShareTone, string> = {
  primary: 'bg-primary',
  live: 'bg-live',
  ink: 'bg-ink',
  muted: 'bg-line',
}

/** Доли целого одной полосой: «участия по возрастным группам». До 4 частей, остальное — в «Другое» */
export function ShareBar({
  data,
  className,
}: {
  data: (ChartDatum & { tone: ShareTone })[]
  className?: string
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1
  return (
    <figure className={cn('flex flex-col gap-3', className)}>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-xs" aria-hidden="true">
        {data.map((item, index) => (
          <span
            key={item.label}
            data-tooltip={`${item.label}: ${formatNumber(item.value)} (${Math.round((item.value / total) * 100)}%)`}
            style={{ flexGrow: item.value, animationDelay: `${index * 80}ms` }}
            className={cn('h-full min-w-1 origin-left animate-grow', shareTones[item.tone])}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {data.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span aria-hidden="true" className={cn('size-2.5 rounded-xs', shareTones[item.tone])} />
            <span className="text-ink">{item.label}</span>
            <span className="font-mono text-muted tabular-nums">
              {formatNumber(item.value)} · {Math.round((item.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

function DataTable({ data, unit }: { data: ChartDatum[]; unit: string }) {
  return (
    <table className="sr-only">
      <tbody>
        {data.map((item) => (
          <tr key={item.label}>
            <th scope="row">{item.label}</th>
            <td>
              {formatNumber(item.value)}
              {unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
