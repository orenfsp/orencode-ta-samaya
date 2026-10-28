import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  NewsCard,
  newsApi,
  newsKeys,
  statusTitles,
  statusTone,
  useAdminNews,
  useNewsTags,
  type AdminArticle,
  type NewsTransition,
} from '@/entities/news'
import { routes } from '@/shared/config'
import { plural } from '@/shared/lib'
import {
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  FormAlert,
  IconArchive,
  IconButton,
  IconExternal,
  IconPlus,
  IconSearch,
  Input,
  PageHeader,
  Select,
  Skeleton,
  showToast,
} from '@/shared/ui'

import { newsConfirmation } from '../model/transition-confirmation'

const STEP = 20
/** Бэк отдаёт не больше 100 за раз */
const MAX = 100

const statusOptions = [
  { value: '', label: 'Все статусы' },
  { value: 'draft', label: 'Черновики' },
  { value: 'published', label: 'Опубликованные' },
  { value: 'archived', label: 'Архив' },
]

const transitionToast: Record<NewsTransition, string> = {
  publish: 'Статья опубликована',
  unpublish: 'Статья снята с публикации',
  archive: 'Статья в архиве',
  restore: 'Статья вернулась в черновики',
}

/** Главное действие карточки по статусу */
const primary: Record<AdminArticle['status'], { action: NewsTransition; label: string }> = {
  draft: { action: 'publish', label: 'Опубликовать' },
  published: { action: 'unpublish', label: 'Снять' },
  archived: { action: 'restore', label: 'Восстановить' },
}

/** Новости в кабинете федерации: черновики, опубликованные и архив */
export function NewsAdminPage() {
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [limit, setLimit] = useState(STEP)
  const [archiving, setArchiving] = useState<AdminArticle | null>(null)
  const [confirming, setConfirming] = useState<{ item: AdminArticle; action: NewsTransition } | null>(null)
  const q = (params.get('q') ?? '').slice(0, 200)
  const status = params.get('status') ?? ''
  const tag = params.get('tag') ?? ''
  const news = useAdminNews(
    { q: q.trim() || undefined, status: status || undefined, tag: tag || undefined },
    limit,
  )
  const tags = useNewsTags()
  const filtered = Boolean(q || status || tag)

  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: NewsTransition }) => newsApi.transition(id, action),
    onSuccess: async (_, { action }) => {
      showToast(transitionToast[action], { tone: 'success' })
      await client.invalidateQueries({ queryKey: newsKeys.all })
    },
  })

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

  const items = news.data?.items ?? []
  const total = news.data?.total ?? 0

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('federation') },
          { label: 'Новости' },
        ]}
        title="Новости"
        description="Статьи федерации. Опубликованные видны на сайте и на главной"
        actions={
          <Button to={routes.newsNew} leftIcon={<IconPlus size={18} />}>
            Новая статья
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_13rem_13rem] lg:items-end">
        <Field label="Поиск" className="col-span-2 lg:col-span-1">
          <Input
            type="search"
            maxLength={200}
            placeholder="Заголовок или анонс"
            leftIcon={<IconSearch size={18} />}
            value={q}
            onChange={(event) => update({ q: event.target.value }, true)}
          />
        </Field>
        <Field label="Статус">
          <Select
            value={status}
            options={statusOptions}
            onChange={(event) => update({ status: event.target.value })}
          />
        </Field>
        <Field label="Хэштег">
          <Select
            value={tag}
            disabled={tags.isPending}
            onChange={(event) => update({ tag: event.target.value })}
            options={[
              { value: '', label: 'Все' },
              ...(tags.data ?? []).map((item) => ({ value: item.name, label: `#${item.name}` })),
            ]}
          />
        </Field>
      </div>

      {transition.isError && <FormAlert>{transition.error.message}</FormAlert>}

      {news.isPending ? (
        <div className="grid gap-4 min-[1920px]:grid-cols-4 sm:grid-cols-2 2xl:grid-cols-3">
          {[1, 2, 3].map((id) => (
            <Skeleton key={id} className="h-96 rounded-xl" />
          ))}
        </div>
      ) : news.isError ? (
        <ErrorState error={news.error} onRetry={() => news.refetch()} />
      ) : !items.length ? (
        <Card>
          <EmptyState
            title={filtered ? 'Ничего не нашлось' : 'Статей пока нет'}
            description={filtered ? 'Измените поиск или фильтры' : 'Новая статья сохранится черновиком'}
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setLimit(STEP)
                    setParams({})
                  }}
                >
                  Сбросить фильтры
                </Button>
              ) : (
                <Button to={routes.newsNew} leftIcon={<IconPlus size={18} />}>
                  Новая статья
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-5" aria-busy={news.isFetching}>
          <p className="font-mono text-sm text-muted">
            {total} {plural(total, ['статья', 'статьи', 'статей'])}
          </p>
          <div className="grid gap-4 min-[1920px]:grid-cols-4 sm:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => {
              const main = primary[item.status]
              return (
                <NewsCard
                  key={item.id}
                  article={item}
                  status={{ tone: statusTone[item.status], title: statusTitles[item.status] }}
                  footer={
                    <div className="flex items-center gap-2 border-t border-line-soft pt-4">
                      <Button variant="secondary" size="sm" to={routes.newsEdit(item.id)}>
                        {item.status === 'archived' ? 'Открыть' : 'Изменить'}
                      </Button>
                      <Button
                        size="sm"
                        variant={item.status === 'draft' ? 'primary' : 'outline'}
                        loading={transition.isPending && transition.variables?.id === item.id}
                        disabled={transition.isPending}
                        onClick={() => setConfirming({ item, action: main.action })}
                      >
                        {main.label}
                      </Button>
                      <span className="ml-auto flex items-center gap-1">
                        {item.status === 'published' && (
                          <IconButton
                            aria-label="Открыть на сайте"
                            size="sm"
                            icon={<IconExternal size={18} />}
                            to={routes.newsArticle(item.slug)}
                          />
                        )}
                        {item.status !== 'archived' && (
                          <IconButton
                            aria-label="В архив"
                            size="sm"
                            icon={<IconArchive size={18} />}
                            disabled={transition.isPending}
                            onClick={() => {
                              transition.reset()
                              setArchiving(item)
                            }}
                          />
                        )}
                      </span>
                    </div>
                  }
                />
              )
            })}
          </div>
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
        </div>
      )}

      <ConfirmModal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={newsConfirmation[confirming?.action ?? 'publish'].title}
        description={`«${confirming?.item.title ?? ''}». ${newsConfirmation[confirming?.action ?? 'publish'].description}`}
        confirmLabel={newsConfirmation[confirming?.action ?? 'publish'].label}
        onConfirm={async () => {
          if (confirming) await transition.mutateAsync({ id: confirming.item.id, action: confirming.action })
        }}
      />

      <ConfirmModal
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        tone="danger"
        title="Отправить статью в архив?"
        description="Она пропадёт с сайта. Текст и вложения сохранятся, статью можно вернуть в черновики"
        confirmLabel="В архив"
        onConfirm={async () => {
          if (archiving) await transition.mutateAsync({ id: archiving.id, action: 'archive' })
        }}
      />
    </div>
  )
}
