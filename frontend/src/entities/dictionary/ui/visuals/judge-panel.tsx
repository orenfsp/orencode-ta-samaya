import { cn } from '@/shared/lib'
import type { AnyDictionaryItem } from '../../model/types'
import { VisualFrame, visualItemClass } from './visual-frame'

/**
 * Ярус должности в коллегии по смыслу названия: главный судья → заместитель и главный секретарь →
 * заместитель секретаря → остальные судьи. Новая должность без пары встаёт в нижний ряд.
 */
function tierOf(name: string) {
  // Без \w и \b: в регулярках JS они понимают только латиницу, кириллицу не ловят
  const text = name.toLowerCase()
  const deputy = text.includes('замест')
  if (text.includes('главный судья') && !deputy) return 0
  if (text.includes('заместитель главного судьи') || (text.includes('главный секретарь') && !deputy)) return 1
  if (text.includes('секретар')) return 2
  return 3
}

/** Судейская коллегия соревнования схемой: кто кому подчиняется */
export function JudgePanel({
  items,
  onSelect,
}: {
  items: AnyDictionaryItem[]
  onSelect: (item: AnyDictionaryItem) => void
}) {
  const active = items.filter((item) => !item.is_archived)
  if (!active.length) return null

  const tiers = [0, 1, 2, 3]
    .map((tier) => active.filter((item) => tierOf(item.name) === tier))
    .filter((tier) => tier.length)

  return (
    <VisualFrame
      label="Судейская коллегия"
      note="Так коллегия собирается на соревновании: должности назначаются судьям с действующей категорией."
    >
      <div className="flex flex-col items-center">
        {tiers.map((tier, index) => (
          <div key={index} className="flex flex-col items-center">
            {index > 0 && <span aria-hidden="true" className="h-5 w-px bg-line" />}
            <div className="relative flex flex-wrap justify-center gap-3">
              {tier.length > 1 && (
                <span aria-hidden="true" className="absolute top-0 right-[15%] left-[15%] h-px bg-line" />
              )}
              {tier.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  style={{ animationDelay: `${index * 120}ms` }}
                  className={cn(
                    visualItemClass,
                    'animate-rise rounded-md border px-4 py-2.5 text-sm hover:-translate-y-0.5',
                    index === 0
                      ? 'border-primary bg-primary text-white hover:bg-primary-hover'
                      : 'border-line-soft bg-canvas text-ink hover:border-line',
                  )}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </VisualFrame>
  )
}
