import { cn } from '@/shared/lib'
import type { AnyDictionaryItem } from '../../model/types'
import { VisualFrame, visualItemClass } from './visual-frame'

const GRADES = Array.from({ length: 11 }, (_, index) => index + 1)

/** «5–9 классы» → [5, 9], «11 класс» → [11, 11]; без классов (студенты) → null */
function gradeRange(name: string): [number, number] | null {
  const range = name.match(/(\d{1,2})\s*[–—-]\s*(\d{1,2})\s*класс/i)
  if (range) return [Number(range[1]), Number(range[2])]
  const single = name.match(/(\d{1,2})\s*класс/i)
  return single ? [Number(single[1]), Number(single[1])] : null
}

/**
 * Школьный путь: 11 классов и полоски групп поверх них, дальше — группы после школы.
 * Сразу видно, если какой-то класс не попал ни в одну группу.
 */
export function AcademicTrack({
  items,
  onSelect,
}: {
  items: AnyDictionaryItem[]
  onSelect: (item: AnyDictionaryItem) => void
}) {
  const active = items.filter((item) => !item.is_archived)
  if (!active.length) return null

  const school = active
    .map((item) => ({ item, range: gradeRange(item.name) }))
    .filter((entry): entry is { item: AnyDictionaryItem; range: [number, number] } => entry.range !== null)
    .sort((a, b) => a.range[0] - b.range[0])
  const after = active.filter((item) => gradeRange(item.name) === null)
  const uncovered = GRADES.filter(
    (grade) => !school.some(({ range }) => range[0] <= grade && grade <= range[1]),
  )

  return (
    <VisualFrame
      label="Школьные классы и группы"
      note={
        uncovered.length ? (
          <span className="text-danger-text">Не входят ни в одну группу: {uncovered.join(', ')} класс</span>
        ) : (
          'Каждый класс с 1 по 11 попадает в группу.'
        )
      }
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 grid grid-cols-11 gap-1">
            {school.map(({ item, range }, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                style={{
                  gridColumn: `${range[0]} / ${range[1] + 1}`,
                  gridRow: 1,
                  animationDelay: `${index * 80}ms`,
                }}
                className={cn(
                  visualItemClass,
                  'h-9 origin-left animate-grow truncate rounded-sm bg-primary px-2 text-left text-sm text-white hover:bg-primary-hover',
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-11 gap-1">
            {GRADES.map((grade) => (
              <span
                key={grade}
                className={cn(
                  'grid h-8 place-items-center rounded-xs border font-mono text-xs',
                  uncovered.includes(grade)
                    ? 'border-danger text-danger-text'
                    : 'border-line-soft text-muted',
                )}
              >
                {grade}
              </span>
            ))}
          </div>
          <p className="mt-2 font-mono text-xs text-muted">классы</p>
        </div>

        {after.length > 0 && (
          <div className="flex shrink-0 flex-col gap-1 lg:w-44">
            {after.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  visualItemClass,
                  'h-9 truncate rounded-sm bg-paper px-3 text-left text-sm text-on-paper hover:bg-paper-2',
                )}
              >
                {item.name}
              </button>
            ))}
            <p className="mt-1 font-mono text-xs text-muted">после школы</p>
          </div>
        )}
      </div>
    </VisualFrame>
  )
}
