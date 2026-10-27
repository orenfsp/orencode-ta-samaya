import { useState } from 'react'

/**
 * Выбор строк для массовых действий (модерация заявок, судей). Хранит id, а не объекты:
 * после перезапроса списка выбор не теряется, пропавшие id просто не совпадут.
 */
export function useSelection<T extends string | number>() {
  const [selected, setSelected] = useState<T[]>([])
  const has = (id: T) => selected.includes(id)
  return {
    selected,
    count: selected.length,
    has,
    toggle: (id: T) =>
      setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id])),
    /** «Выбрать все» на видимой странице: если все уже выбраны — снимает */
    toggleAll: (ids: T[]) =>
      setSelected((current) =>
        ids.every((id) => current.includes(id))
          ? current.filter((id) => !ids.includes(id))
          : [...new Set([...current, ...ids])],
      ),
    allOf: (ids: T[]) => ids.length > 0 && ids.every(has),
    someOf: (ids: T[]) => ids.some(has) && !ids.every(has),
    clear: () => setSelected([]),
  }
}
