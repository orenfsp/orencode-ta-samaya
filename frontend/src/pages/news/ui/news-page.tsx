import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { NewsCard, useNews, useNewsTags } from '@/entities/news'
import { routes } from '@/shared/config'
import { plural } from '@/shared/lib'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  IconSearch,
  Input,
  PageHeader,
  Select,
  Skeleton,
} from '@/shared/ui'

const STEP = 12
/** Бэк отдаёт не больше 100 за раз — дальше «Показать ещё» не растёт */
const MAX = 100

/** Лента новостей: поиск и хэштег в адресе, «Показать ещё» — как в каталоге соревнований */
export function NewsPage() {
  const [params, setParams] = useSearchParams()
  const [limit, setLimit] = useState(STEP)
  const q = (params.get('q') ?? '').slice(0, 200)
  const tag = params.get('tag') ?? ''
  const section = params.get('section') ?? ''
  const news = useNews(
    { q: q.trim() || undefined, tag: tag || undefined, section: section || undefined },
    limit,
  )
  const tags = useNewsTags()
  const filtered = Boolean(q || tag || section)

  const update = (values: Record<string, string>, replace = false) => {
    setLimit(STEP)
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        Object.entries(values).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
        return next
      },
      { replace },
    )
  }
  const reset = () => {
    setLimit(STEP)
    setParams({})
  }

  const items = news.data?.items ?? []
  const total = news.data?.total ?? 0

  return (
    <div className="container-page flex flex-col gap-8 py-8 sm:py-12">
      <PageHeader
        crumbs={[{ label: 'Главная', to: routes.home }, { label: 'Новости' }]}
        title="Новости"
        description="Новости и анонсы федерации спортивного программирования Оренбургской области"
      />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end">
        <Field label="Поиск">
          <Input
            type="search"
            maxLength={200}
            placeholder="Заголовок или анонс"
            leftIcon={<IconSearch size={18} />}
            value={q}
            onChange={(event) => update({ q: event.target.value }, true)}
          />
        </Field>
        <Field label="Хэштег">
          <Select
            value={tag}
            disabled={tags.isPending}
            onChange={(event) => update({ tag: event.target.value })}
            options={[
              { value: '', label: 'Все' },
              ...(tags.data ?? []).map((item) => ({
                value: item.name,
                label: `#${item.name} · ${item.count}`,
              })),
            ]}
          />
        </Field>
      </div>

      {section && (
        <p className="flex flex-wrap items-center gap-3 text-body text-muted">
          Раздел: <span className="text-ink">{section}</span>
          <Button variant="text" size="sm" onClick={() => update({ section: '' })}>
            Все разделы
          </Button>
        </p>
      )}

      <section className="flex flex-col gap-5" aria-label="Лента новостей" aria-busy={news.isFetching}>
        {news.data && (
          <p className="font-mono text-sm text-muted">
            {total} {plural(total, ['статья', 'статьи', 'статей'])}
          </p>
        )}
        {news.isPending ? (
          <div className="grid gap-4 min-[1920px]:grid-cols-4 sm:grid-cols-2 2xl:grid-cols-3">
            {[1, 2, 3].map((id) => (
              <Skeleton key={id} className="h-96 rounded-lg" />
            ))}
          </div>
        ) : news.isError ? (
          <ErrorState error={news.error} onRetry={() => news.refetch()} />
        ) : !items.length ? (
          <Card>
            <EmptyState
              title={filtered ? 'Ничего не нашлось' : 'Новостей пока нет'}
              description={filtered ? 'Измените запрос или хэштег' : 'Опубликованные статьи появятся здесь'}
              action={
                filtered ? (
                  <Button variant="secondary" onClick={reset}>
                    Сбросить фильтры
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <>
            <ul className="grid gap-4 min-[1920px]:grid-cols-4 sm:grid-cols-2 2xl:grid-cols-3">
              {items.map((article) => (
                <li key={article.id}>
                  <NewsCard article={article} />
                </li>
              ))}
            </ul>
            {items.length < total && limit < MAX && (
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="secondary"
                  loading={news.isFetching}
                  onClick={() => setLimit((current) => Math.min(MAX, current + STEP))}
                >
                  Показать ещё
                </Button>
                <span className="font-mono text-sm text-muted">
                  {items.length} из {total}
                </span>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
