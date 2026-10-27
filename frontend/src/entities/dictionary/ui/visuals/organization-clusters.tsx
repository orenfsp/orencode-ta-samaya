import { cn } from '@/shared/lib'
import type { AnyDictionaryItem } from '../../model/types'
import { VisualFrame, visualItemClass } from './visual-frame'

// Где спортсмен может заниматься: по смыслу названия типа организации
const clusters = [
  {
    id: 'edu',
    title: 'Образование',
    hint: 'школы, колледжи, вузы',
    test: /школ|лице|гимназ|колледж|техникум|вуз|университет|институт|академ/i,
  },
  { id: 'sport', title: 'Спорт', hint: 'спортшколы и клубы', test: /спорт|клуб/i },
  { id: 'business', title: 'Компании', hint: 'и организаторы', test: /компан|предприят|коммерч/i },
  { id: 'self', title: 'Самостоятельно', hint: 'без организации', test: /без организ|самостоят/i },
] as const

function clusterOf(name: string) {
  // «Спортивная школа» — это спорт, а не общее образование
  if (/спорт/i.test(name)) return 'sport'
  return clusters.find((cluster) => cluster.test.test(name))?.id ?? 'other'
}

/** Типы организаций по сферам: где вообще можно заниматься спортивным программированием в регионе */
export function OrganizationClusters({
  items,
  onSelect,
}: {
  items: AnyDictionaryItem[]
  onSelect: (item: AnyDictionaryItem) => void
}) {
  const active = items.filter((item) => !item.is_archived)
  if (!active.length) return null

  const groups = [...clusters, { id: 'other' as const, title: 'Другое', hint: '' }]
    .map((cluster) => ({ ...cluster, items: active.filter((item) => clusterOf(item.name) === cluster.id) }))
    .filter((group) => group.items.length)

  return (
    <VisualFrame label="Типы организаций по сферам">
      <div className="grid gap-px overflow-hidden rounded-md border border-line-soft bg-line-soft sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((group, index) => (
          <div
            key={group.id}
            style={{ animationDelay: `${index * 60}ms` }}
            className="flex animate-rise flex-col gap-3 bg-canvas p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-body text-ink">{group.title}</span>
              <span className="font-mono text-h3 text-muted">{group.items.length}</span>
            </div>
            {group.hint && <span className="-mt-2 text-xs text-muted">{group.hint}</span>}
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className={cn(
                      visualItemClass,
                      'w-full rounded-sm px-2 py-1 text-left text-sm text-muted hover:bg-hover-tint hover:text-ink',
                    )}
                  >
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </VisualFrame>
  )
}
