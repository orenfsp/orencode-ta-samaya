import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '@/shared/lib'
import { controlClass, controlSize, useField } from './field-context'
import { IconChevronDown } from './icons'
import { Popover } from './popover'

export interface SearchSelectOption {
  value: string
  label: string
  /** Вторая строка: ИНН организации, муниципалитет */
  description?: string
}

export interface SearchSelectProps {
  value: string | null
  options: SearchSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  emptyText?: string
}

const LIST_MAX_H = 264

// «Ё» и регистр не должны мешать найти «Королёв» по «королев»
const normalize = (text: string) => text.toLowerCase().replaceAll('ё', 'е').trim()

/**
 * Комбобокс с поиском по списку: организация, муниципалитет, спортсмен.
 * Фокус остаётся в поле (иначе ввод оборвётся), подсветка — через aria-activedescendant.
 */
export function SearchSelect({
  value,
  options,
  onChange,
  placeholder = 'Начните вводить',
  disabled,
  emptyText = 'Ничего не нашлось',
}: SearchSelectProps) {
  const field = useField()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const baseId = useId()
  const listId = `${baseId}-list`
  const optionId = (index: number) => `${baseId}-option-${index}`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const selected = options.find((option) => option.value === value)
  const needle = normalize(query)
  const filtered = needle
    ? options.filter(
        (option) =>
          normalize(option.label).includes(needle) || normalize(option.description ?? '').includes(needle),
      )
    : options

  // Активный пункт держим в зоне видимости списка, не прокручивая модалку вокруг
  useLayoutEffect(() => {
    const list = listRef.current
    const item = list?.children[active] as HTMLElement | undefined
    if (!open || !list || !item) return
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight
  }, [active, open])

  const openList = () => {
    setActive(0)
    setOpen(true)
  }

  const close = () => {
    setQuery('')
    setOpen(false)
  }

  const pick = (option: SearchSelectOption) => {
    onChange(option.value)
    close()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      openList()
      return
    }
    if (!open) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = filtered[active]
      if (option) pick(option)
    } else if (event.key === 'Tab') {
      close()
    }
  }

  return (
    <div className="group relative">
      <input
        ref={inputRef}
        id={field?.id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? optionId(active) : undefined}
        aria-required={field?.required || undefined}
        aria-invalid={field?.invalid || undefined}
        aria-describedby={field?.describedBy}
        value={open ? query : (selected?.label ?? '')}
        placeholder={selected?.label ?? placeholder}
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
          if (!open) setOpen(true)
        }}
        onFocus={openList}
        onClick={() => !open && openList()}
        onKeyDown={onKeyDown}
        className={cn(controlClass, controlSize[field?.size ?? 'md'], 'pr-11')}
      />
      <IconChevronDown
        size={18}
        className={cn(
          'pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted transition-[rotate,color] duration-220 ease-emphasized',
          open && 'rotate-180 text-ink',
        )}
      />
      <Popover open={open} onClose={close} anchorRef={inputRef} matchWidth>
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          className="overflow-y-auto"
          style={{ maxHeight: LIST_MAX_H }}
        >
          {filtered.length === 0 && <div className="px-3 py-2.5 text-body text-muted">{emptyText}</div>}
          {filtered.map((option, index) => {
            const isSelected = option.value === value
            return (
              <div
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(index)}
                // mousedown, а не click: click пришёл бы уже после blur поля
                onMouseDown={(event) => {
                  event.preventDefault()
                  pick(option)
                }}
                className={cn(
                  'flex cursor-pointer flex-col rounded-md px-3 py-2 transition-colors duration-100',
                  index === active && 'bg-hover-tint',
                  isSelected && 'bg-primary-soft',
                )}
              >
                <span className="text-body text-ink">{option.label}</span>
                {option.description && <span className="text-sm text-muted">{option.description}</span>}
              </div>
            )
          })}
        </div>
      </Popover>
    </div>
  )
}
