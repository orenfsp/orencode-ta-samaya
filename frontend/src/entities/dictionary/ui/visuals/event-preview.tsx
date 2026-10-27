import { useState } from 'react'
import { Button, IconCalendar, IconMapPin, IconPencil, MetaTag, Tabs } from '@/shared/ui'
import type { AnyDictionaryItem } from '../../model/types'
import { VisualFrame } from './visual-frame'

type Mode = 'type' | 'format'

/** Как формат выглядит в карточке: бейджи «Онлайн» / «Оффлайн» (кит) и место проведения */
function formatLook(name: string) {
  const online = /онлайн|дистанц/i.test(name)
  const offline = /очно|оффлайн|офлайн/i.test(name)
  const mixed = /смешан|гибрид/i.test(name) || (online && offline)
  if (mixed) return { badges: ['Онлайн', 'Оффлайн'], place: 'Разработка онлайн, финал в г. Оренбург' }
  if (online) return { badges: ['Онлайн'], place: 'По месту нахождения участников' }
  if (offline) return { badges: ['Оффлайн'], place: 'г. Оренбург' }
  return { badges: [name], place: 'г. Оренбург' }
}

/**
 * Живое превью: так значение справочника выглядит в карточке соревнования в календаре.
 * Переключаешь значение — карточка меняется. Остальные поля карточки — пример.
 */
export function EventPreview({
  mode,
  items,
  onSelect,
}: {
  mode: Mode
  items: AnyDictionaryItem[]
  onSelect: (item: AnyDictionaryItem) => void
}) {
  const active = items.filter((item) => !item.is_archived)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const picked = active.find((item) => item.id === pickedId) ?? active[0]
  if (!picked) return null

  const look = mode === 'format' ? formatLook(picked.name) : null
  const title =
    mode === 'type'
      ? `${picked.name} Оренбургской области по алгоритмическому программированию`
      : 'Первенство Оренбургской области по продуктовому программированию'

  return (
    <VisualFrame
      label="Как значение выглядит в календаре"
      note="Так значение увидят участники. Дата, дисциплина и место условные."
    >
      <Tabs
        aria-label="Значение для превью"
        value={String(picked.id)}
        onChange={(value) => setPickedId(Number(value))}
        items={active.map((item) => ({ value: String(item.id), label: item.name }))}
      />

      <article
        key={picked.id}
        className="flex animate-rise flex-col gap-4 rounded-md border border-line-soft bg-canvas p-5 sm:max-w-xl"
      >
        <div className="flex flex-wrap gap-2">
          {(look?.badges ?? ['Оффлайн']).map((badge) => (
            <MetaTag key={badge} accent={badge === 'Онлайн'}>
              {badge}
            </MetaTag>
          ))}
          <MetaTag>14-18</MetaTag>
        </div>
        <h3 className="text-h3 font-medium text-balance">{title}</h3>
        <div className="flex flex-col gap-1.5 text-sm text-muted">
          <span className="flex items-center gap-2">
            <IconCalendar size={16} /> 14.11.2026
          </span>
          <span className="flex items-center gap-2">
            <IconMapPin size={16} /> {look?.place ?? 'г. Оренбург'}
          </span>
        </div>
        {picked.description && (
          <p className="border-t border-line-soft pt-3 text-sm text-muted">{picked.description}</p>
        )}
      </article>

      <Button
        variant="text"
        size="sm"
        leftIcon={<IconPencil size={16} />}
        onClick={() => onSelect(picked)}
        className="self-start"
      >
        Изменить «{picked.name}»
      </Button>
    </VisualFrame>
  )
}
