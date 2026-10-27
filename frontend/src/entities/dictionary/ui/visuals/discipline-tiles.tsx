import { cn } from '@/shared/lib'
import { DisciplineIcon } from '@/shared/ui'
import type { AnyDictionaryItem } from '../../model/types'
import { VisualFrame, visualItemClass } from './visual-frame'

// Официальные иконки дисциплин из public/brand (с главной fsp-russia.ru). Значения — свободный текст, сопоставляем по смыслу
const icons: [RegExp, string][] = [
  [/алгоритм|олимпиад/i, 'algorithmic'],
  [/продукт|хакатон/i, 'product'],
  [/безопасн|ctf|кибер/i, 'security'],
  [/искусствен|машинн|(^|\s)ии($|\s)/i, 'ai'],
  [/робот/i, 'robotics'],
  [/беспилот|(^|\s)бас($|\s)|бпла|дрон/i, 'drones'],
  [/квиз|викторин|интеллектуальн/i, 'quiz'],
]

// Без совпадения — общая иконка в том же стиле, а не буква в квадрате
const iconFor = (name: string) => icons.find(([pattern]) => pattern.test(name))?.[1] ?? 'generic'

/** Дисциплины плитками с фирменными иконками — так они выглядят на сайте федерации */
export function DisciplineTiles({
  items,
  onSelect,
}: {
  items: AnyDictionaryItem[]
  onSelect: (item: AnyDictionaryItem) => void
}) {
  const active = items.filter((item) => !item.is_archived)
  if (!active.length) return null

  return (
    <VisualFrame label="Дисциплины">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {active.map((item, index) => {
          const icon = iconFor(item.name)
          return (
            <li key={item.id} style={{ animationDelay: `${index * 40}ms` }} className="animate-rise">
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  visualItemClass,
                  'group flex h-full w-full flex-col items-start gap-4 rounded-md border border-line-soft bg-canvas/60 p-4 text-left hover:-translate-y-0.5 hover:border-line',
                )}
              >
                <DisciplineIcon
                  name={icon}
                  className="size-10 transition-[translate] duration-340 ease-spring group-hover:-translate-y-0.5"
                />
                <span className="line-clamp-3 text-sm text-ink">{item.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </VisualFrame>
  )
}
