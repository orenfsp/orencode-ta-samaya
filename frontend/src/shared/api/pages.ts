import type { InfiniteData } from '@tanstack/react-query'

/** Страница списка с бэка: элементы и сколько всего */
export interface ListPage<T> {
  items: T[]
  total: number
}

/**
 * «Показать ещё» по offset: каждая следующая страница — только новые записи.
 * Следующий offset — сколько уже загружено; дальше нет, когда загружено всё или пришла пустая страница.
 */
export const offsetPaging = {
  initialPageParam: 0,
  getNextPageParam: <T>(last: ListPage<T>, pages: ListPage<T>[]) => {
    const loaded = pages.reduce((sum, page) => sum + page.items.length, 0)
    return last.items.length && loaded < last.total ? loaded : undefined
  },
}

/** Страницы подряд одним списком: то, что рисует экран */
export const flatPages = <T>(data: InfiniteData<ListPage<T>>): ListPage<T> => ({
  items: data.pages.flatMap((page) => page.items),
  total: data.pages.at(-1)?.total ?? 0,
})
