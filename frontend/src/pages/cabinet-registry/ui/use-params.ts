import { useSearchParams } from 'react-router'

export const PAGE = 50

/** Фильтры и страница реестра живут в адресе: ссылкой можно поделиться, «Назад» работает */
export function useRegistryParams() {
  const [params, setParams] = useSearchParams()
  const get = (key: string) => params.get(key) ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }
  const reset = (keep: string[]) => {
    const next = new URLSearchParams()
    for (const key of keep) if (params.get(key)) next.set(key, params.get(key)!)
    setParams(next)
  }
  return { get, page, change, reset, params }
}

export const toId = (value: string) => (value ? Number(value) : undefined)
