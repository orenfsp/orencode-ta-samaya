import { cn } from '@/shared/lib'
import { formatMonths } from '../lib/describe'
import type { AnyDictionaryItem } from '../model/types'

const kindOrder: Record<string, number> = {
  'Юношеский разряд': 0,
  'Спортивный разряд': 1,
  'Спортивное звание': 2,
}

/**
 * Место разряда в иерархии. Бэк отдаёт список по алфавиту, а лестнице нужен порядок «снизу вверх»:
 * вид → номер (третий, второй, первый) → звания по старшинству.
 */
function weight(item: AnyDictionaryItem) {
  const name = item.name.toLowerCase()
  const step = name.startsWith('трет')
    ? 0
    : name.startsWith('втор')
      ? 1
      : name.startsWith('перв')
        ? 2
        : name.startsWith('кандидат')
          ? 3
          : name.includes('заслуж')
            ? 6
            : name.includes('международ')
              ? 5
              : 4
  return (kindOrder[item.rank_kind ?? ''] ?? 1) * 10 + step
}

/** Короткая подпись ступени: «III юн.», «КМС», «МСМК» */
function shortName(item: AnyDictionaryItem) {
  const name = item.name.toLowerCase()
  const roman = name.startsWith('трет')
    ? 'III'
    : name.startsWith('втор')
      ? 'II'
      : name.startsWith('перв')
        ? 'I'
        : ''
  if (item.rank_kind === 'Юношеский разряд') return `${roman} юн.`
  if (name.startsWith('кандидат')) return 'КМС'
  if (name.includes('заслуж')) return 'ЗМС'
  if (name.includes('международ')) return 'МСМК'
  if (item.rank_kind === 'Спортивное звание') return 'МС'
  return roman || item.name.slice(0, 4)
}

/** Лестница разрядов и званий: ступени растут к званиям, под каждой — возраст и срок */
export function RankLadder({
  ranks,
  onSelect,
}: {
  ranks: AnyDictionaryItem[]
  onSelect?: (item: AnyDictionaryItem) => void
}) {
  const active = ranks.filter((rank) => !rank.is_archived).sort((a, b) => weight(a) - weight(b))
  if (!active.length) return null

  return (
    <section
      aria-label="Лестница разрядов"
      className="grid-texture overflow-x-auto rounded-lg border border-line-soft p-5 sm:p-6"
    >
      <ol className="flex items-end gap-2">
        {active.map((rank, index) => {
          const title = rank.rank_kind === 'Спортивное звание'
          const height = 3 + (index / Math.max(active.length - 1, 1)) * 9
          return (
            <li
              key={rank.id}
              data-tooltip={rank.name}
              tabIndex={0}
              role="button"
              onClick={() => onSelect?.(rank)}
              onKeyDown={(event) => event.key === 'Enter' && onSelect?.(rank)}
              className="group flex min-w-14 flex-1 cursor-pointer flex-col items-center gap-2 outline-none"
            >
              <span
                style={{ height: `${height}rem`, animationDelay: `${index * 50}ms` }}
                className={cn(
                  'flex w-full origin-bottom animate-grow-up items-start justify-center rounded-t-md pt-2 font-mono text-sm transition-[filter,translate] duration-220 group-hover:-translate-y-1 group-focus-visible:-translate-y-1',
                  title
                    ? 'bg-primary text-white'
                    : rank.rank_kind === 'Юношеский разряд'
                      ? 'bg-surface-3 text-ink'
                      : 'bg-line text-ink',
                )}
              >
                {shortName(rank)}
              </span>
              <span className="flex flex-col items-center text-center font-mono text-xs leading-snug text-muted">
                <span>{rank.min_age != null ? `с ${rank.min_age}` : '—'}</span>
                <span className="text-ink">
                  {rank.is_lifetime ? '∞' : rank.validity_months ? formatMonths(rank.validity_months) : '—'}
                </span>
                {rank.valid_until_age != null && <span>до {rank.valid_until_age}</span>}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="mt-4 text-sm text-muted">
        Под ступенью: минимальный возраст, срок действия (∞ — пожизненно) и предельный возраст для юношеских.
      </p>
    </section>
  )
}
