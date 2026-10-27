import { useState } from 'react'
import { cn, plural } from '@/shared/lib'
import type { AnyDictionaryItem } from '../../model/types'
import { VisualFrame } from './visual-frame'

const kinds = [
  { id: 'city', label: 'Города', test: (name: string) => /^г\.\s/i.test(name), tone: 'bg-primary' },
  {
    id: 'okrug',
    label: 'Городские и муниципальные округа',
    test: (name: string) => /округ/i.test(name),
    tone: 'bg-ink',
  },
  { id: 'district', label: 'Районы', test: (name: string) => /район/i.test(name), tone: 'bg-muted' },
  { id: 'zato', label: 'ЗАТО', test: (name: string) => /зато/i.test(name), tone: 'bg-live' },
] as const

type KindId = (typeof kinds)[number]['id'] | 'other'

const kindOf = (name: string): KindId =>
  kinds.find((kind) => kind.id !== 'okrug' && kind.test(name))?.id ??
  (kinds[1].test(name) ? 'okrug' : 'other')

/**
 * Состав муниципалитетов области: какая доля — города, округа, районы.
 * Группа выбирается кликом по полосе или легенде и остаётся выбранной (по умолчанию первая) —
 * список не пропадает, когда курсор уходит к нему. Наведение только подсвечивает часть полосы.
 */
export function MunicipalityStructure({
  items,
  onSelect,
}: {
  items: AnyDictionaryItem[]
  onSelect: (item: AnyDictionaryItem) => void
}) {
  const [picked, setPicked] = useState<KindId | null>(null)
  const [hover, setHover] = useState<KindId | null>(null)
  const active = items.filter((item) => !item.is_archived)
  if (!active.length) return null

  const groups = [...kinds, { id: 'other' as const, label: 'Другое', tone: 'bg-line' }]
    .map((kind) => ({ ...kind, items: active.filter((item) => kindOf(item.name) === kind.id) }))
    .filter((group) => group.items.length)
  const shown = groups.find((group) => group.id === picked) ?? groups[0]!
  const focus = hover ?? shown.id

  return (
    <VisualFrame label="Состав муниципалитетов">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-h2 font-medium">
          {active.length}
          <span className="ml-3 text-body text-muted">
            {plural(active.length, [
              'муниципальное образование',
              'муниципальных образования',
              'муниципальных образований',
            ])}
          </span>
        </p>
      </div>

      <div className="flex h-3 w-full gap-1 overflow-hidden rounded-full" onMouseLeave={() => setHover(null)}>
        {groups.map((group, index) => (
          <button
            key={group.id}
            type="button"
            aria-label={`${group.label}: ${group.items.length}`}
            aria-pressed={group.id === shown.id}
            onMouseEnter={() => setHover(group.id)}
            onClick={() => setPicked(group.id)}
            style={{ flexGrow: group.items.length, animationDelay: `${index * 80}ms` }}
            className={cn(
              'h-full min-w-2 origin-left animate-grow transition-opacity duration-220',
              group.tone,
              focus !== group.id && 'opacity-30',
            )}
          />
        ))}
      </div>

      <ul className="-mx-2 flex flex-wrap gap-x-2 gap-y-1 text-sm">
        {groups.map((group) => (
          <li key={group.id}>
            <button
              type="button"
              aria-pressed={group.id === shown.id}
              onMouseEnter={() => setHover(group.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setPicked(group.id)}
              className={cn(
                'flex items-center gap-2 rounded-sm px-2 py-1 transition-[opacity,background-color] duration-220',
                group.id === shown.id ? 'bg-surface-3' : 'hover:bg-hover-tint',
                focus !== group.id && 'opacity-60',
              )}
            >
              <span aria-hidden="true" className={cn('size-2.5 rounded-full', group.tone)} />
              <span className="text-ink">{group.label}</span>
              <span className="font-mono text-muted">{group.items.length}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* key — список заново «всплывает» при смене группы */}
      <ul key={shown.id} className="flex animate-rise flex-wrap gap-1.5">
        {shown.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="pressable rounded-sm border border-line-soft px-2.5 py-1 text-sm text-ink hover:border-primary hover:text-primary-text"
            >
              {item.name}
            </button>
          </li>
        ))}
      </ul>
    </VisualFrame>
  )
}
