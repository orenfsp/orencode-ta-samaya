import { cn, disciplineIconName } from '@/shared/lib'
import { DisciplineIcon, Field, Select } from '@/shared/ui'

interface Item {
  id: number
  name: string
}

/**
 * Выбор дисциплины для страниц-срезов (рейтинг, сборные): на lg — колонка слева со списком,
 * уже — обычный список выбора. Названия длинные и их семь: в строку вкладок они не помещаются.
 */
export function DisciplineNav({
  items,
  value,
  onChange,
  className,
}: {
  items: Item[]
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={className}>
      <div className="lg:hidden">
        <Field label="Дисциплина">
          <Select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            options={items.map((item) => ({ value: String(item.id), label: item.name }))}
          />
        </Field>
      </div>
      <nav aria-label="Дисциплина" className="hidden lg:block">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const selected = String(item.id) === value
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onChange(String(item.id))}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors focus-visible:field-focus',
                    selected
                      ? 'bg-surface-2 font-medium text-ink light:bg-surface-3'
                      : 'text-muted hover:bg-hover-tint hover:text-ink',
                  )}
                >
                  <DisciplineIcon name={disciplineIconName(item.name)} className="size-6 shrink-0" />
                  <span className="min-w-0">{item.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
