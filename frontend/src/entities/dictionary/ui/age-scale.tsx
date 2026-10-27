import { cn, plural } from '@/shared/lib'
import { formatAgeRange } from '../lib/describe'
import type { AnyDictionaryItem } from '../model/types'

interface Range {
  from: number
  to: number
}

const yearsWord = (value: number) => plural(value, ['год', 'года', 'лет'])

/** Склеивает соседние возрасты в отрезки: [14, 15, 16] → 14–16 */
function toRanges(ages: number[]): Range[] {
  return ages.reduce<Range[]>((ranges, age) => {
    const last = ranges.at(-1)
    if (last && last.to === age - 1) last.to = age
    else ranges.push({ from: age, to: age })
    return ranges
  }, [])
}

const rangeText = ({ from, to }: Range) =>
  from === to ? `${from} ${yearsWord(from)}` : `${from}–${to} ${yearsWord(to)}`

/**
 * Шкала возрастных групп: полоска на каждую группу и проверка покрытия.
 * Ошибку в границах видно глазами — дыру («18 лет никуда не входит») или пересечение двух групп.
 */
export function AgeScale({
  groups,
  onSelect,
}: {
  groups: AnyDictionaryItem[]
  onSelect?: (item: AnyDictionaryItem) => void
}) {
  // Бэк отдаёт по алфавиту, шкале нужен порядок по возрасту
  const active = groups
    .filter((group) => !group.is_archived)
    .sort((a, b) => (a.min_age ?? -1) - (b.min_age ?? -1))
  if (!active.length) return null

  const bounds = active
    .flatMap((group) => [group.min_age, group.max_age])
    .filter((v): v is number => v != null)
  const axisMax = Math.min(Math.max(...bounds, 18) + 4, 100)
  const ages = Array.from({ length: axisMax + 1 }, (_, age) => age)
  const covering = (age: number) =>
    active.filter((group) => (group.min_age ?? 0) <= age && age <= (group.max_age ?? Infinity)).length

  // Дыры ищем только между границами групп: «до 13» и «от 18» сами по себе дырами не считаются
  const lowest = Math.min(...active.map((group) => group.min_age ?? 0))
  const gaps = toRanges(ages.filter((age) => age >= lowest && covering(age) === 0))
  const overlaps = toRanges(ages.filter((age) => covering(age) > 1))
  const percent = (age: number) => `${(age / (axisMax + 1)) * 100}%`
  const ticks = ages.filter((age) => age % (axisMax > 40 ? 10 : 2) === 0)

  return (
    <section
      aria-label="Шкала возрастных групп"
      className="grid-texture flex flex-col gap-5 rounded-lg border border-line-soft p-5 sm:p-6"
    >
      <div className="flex flex-col gap-2.5">
        {active.map((group, index) => {
          const from = group.min_age ?? 0
          const to = group.max_age ?? axisMax
          return (
            <div
              key={group.id}
              className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-ink" title={group.name}>
                  {group.name}
                </span>
                <span className="font-mono text-xs text-muted">
                  {formatAgeRange(group.min_age, group.max_age)}
                </span>
              </span>
              <span className="relative h-8">
                <button
                  type="button"
                  onClick={() => onSelect?.(group)}
                  style={{
                    left: percent(from),
                    width: `calc(${percent(to + 1)} - ${percent(from)})`,
                    animationDelay: `${index * 80}ms`,
                  }}
                  aria-label={`${group.name}: ${formatAgeRange(group.min_age, group.max_age)}`}
                  className={cn(
                    'absolute inset-y-1 origin-left animate-grow cursor-pointer rounded-sm transition-colors duration-150 hover:bg-primary-hover',
                    'bg-primary',
                    group.min_age == null && 'rounded-l-none',
                    group.max_age == null && 'rounded-r-none',
                  )}
                />
              </span>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <span className="font-mono text-xs text-muted">возраст, лет</span>
        <span className="relative h-4 border-t border-line-soft">
          {ticks.map((age) => (
            <span
              key={age}
              style={{ left: percent(age) }}
              className="absolute top-1 -translate-x-1/2 font-mono text-xs text-muted tabular-nums"
            >
              {age}
            </span>
          ))}
        </span>
      </div>

      {gaps.length === 0 && overlaps.length === 0 ? (
        <p className="text-sm text-muted">Группы не пересекаются и покрывают все возрасты.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {gaps.map((range) => (
            <li key={`gap-${range.from}`} className="text-danger-text">
              {rangeText(range)} не входит ни в одну группу
            </li>
          ))}
          {overlaps.map((range) => (
            <li key={`overlap-${range.from}`} className="text-danger-text">
              {rangeText(range)} попадает сразу в несколько групп
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
