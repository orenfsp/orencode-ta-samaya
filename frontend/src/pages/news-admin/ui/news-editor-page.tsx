import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router'
import {
  ArticleContent,
  newsApi,
  newsDate,
  newsKeys,
  NewsCover,
  parseHashtags,
  statusTitles,
  statusTone,
  useAdminArticle,
  type AdminArticle,
  type ArticleInput,
  type Block,
  type NewsTransition,
} from '@/entities/news'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import {
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  FileDrop,
  FormAlert,
  Input,
  Modal,
  PageHeader,
  Skeleton,
  Spinner,
  StatusTag,
  Textarea,
  showToast,
} from '@/shared/ui'
import { newsConfirmation } from '../model/transition-confirmation'
import { emptyBlock } from './block-defaults'
import { AddBlockBar, BlockEditor } from './block-editor'
import { useUploads } from './use-upload'

const MAX_BLOCKS = 100

const toInput = (article?: AdminArticle): ArticleInput => ({
  title: article?.title ?? '',
  section: article?.section ?? null,
  summary: article?.summary ?? null,
  cover_file_id: article?.cover_file_id ?? null,
  blocks: article?.blocks ?? [],
  hashtags: article?.hashtags ?? [],
})

/** Ошибки по блокам до отправки: нет файла, нет названия файла, ссылка не на http(s), пустой текст */
function blockErrors(blocks: Block[]) {
  const errors: Record<number, string> = {}
  blocks.forEach((block, index) => {
    if ((block.type === 'image' || block.type === 'file') && !block.file_id)
      errors[index] = 'Загрузите файл или удалите блок'
    else if (block.type === 'file' && !block.title.trim()) errors[index] = 'Укажите название файла'
    if (block.type === 'link' && !/^https?:\/\/\S+$/i.test(block.url.trim()))
      errors[index] = 'Адрес должен начинаться с http:// или https://'
    if ((block.type === 'text' || block.type === 'heading') && !block.text.trim())
      errors[index] = 'Заполните блок или удалите его'
  })
  return errors
}

const serverMessage = (error: Error) =>
  error instanceof ApiError ? Object.values(error.fields).flat().join('. ') || error.message : error.message

/** Новая статья или правка существующей. Форма пересоздаётся, когда пришла другая статья */
export function NewsEditorPage() {
  const { id } = useParams()
  const article = useAdminArticle(id)

  if (id && article.isPending) return <Skeleton className="h-[32rem] rounded-xl" />
  if (id && article.isError)
    return article.error instanceof ApiError && article.error.status === 404 ? (
      <EmptyState title="Статья не найдена" action={<Button to={routes.newsAdmin}>Все статьи</Button>} />
    ) : (
      <ErrorState error={article.error} onRetry={() => article.refetch()} />
    )

  return <Editor key={id ?? 'new'} initial={article.data} />
}

function Editor({ initial }: { initial?: AdminArticle }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const uploads = useUploads()
  const [draft, setDraft] = useState<ArticleInput>(() => toInput(initial))
  const [tags, setTags] = useState(initial?.hashtags.join(', ') ?? '')
  const [current, setCurrent] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [touched, setTouched] = useState(false)
  const [preview, setPreview] = useState(false)
  const [confirming, setConfirming] = useState<NewsTransition | null>(null)
  // Блокировка ухода читает ref: после «Создать» уходим на страницу правки сразу, не дожидаясь рендера
  const dirtyRef = useRef(false)
  const blocker = useBlocker(() => dirtyRef.current || uploads.busy)

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const markDirty = (value: boolean) => {
    dirtyRef.current = value
    setDirty(value)
  }
  const update = (value: Partial<ArticleInput>) => {
    setDraft((state) => ({ ...state, ...value }))
    markDirty(true)
  }
  const setBlocks = (blocks: Block[]) => update({ blocks })

  const locked = current?.status === 'archived'
  const errors = touched ? blockErrors(draft.blocks) : {}
  const titleError = touched && !draft.title.trim() ? 'Введите заголовок' : undefined

  const save = useMutation({
    mutationFn: () => {
      const body = { ...draft, hashtags: parseHashtags(tags) }
      return current ? newsApi.update(current.id, body) : newsApi.create(body)
    },
    onSuccess: async (saved) => {
      markDirty(false)
      setCurrent(saved)
      showToast(current ? 'Изменения сохранены' : 'Черновик создан', { tone: 'success' })
      await client.invalidateQueries({ queryKey: newsKeys.all })
      if (!current) navigate(routes.newsEdit(saved.id), { replace: true })
    },
  })

  const transition = useMutation({
    mutationFn: (action: NewsTransition) => newsApi.transition(current!.id, action),
    onSuccess: async (saved) => {
      setCurrent(saved)
      showToast(`Статус: ${statusTitles[saved.status].toLowerCase()}`, { tone: 'success' })
      await client.invalidateQueries({ queryKey: newsKeys.all })
    },
  })

  const submit = () => {
    setTouched(true)
    if (!draft.title.trim() || Object.keys(blockErrors(draft.blocks)).length) return
    save.mutate()
  }

  const failure = save.error ?? transition.error
  const busy = save.isPending || transition.isPending || uploads.busy

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('federation') },
          { label: 'Новости', to: routes.newsAdmin },
          { label: current ? current.title : 'Новая статья' },
        ]}
        title={current ? 'Статья' : 'Новая статья'}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPreview(true)}>
              Предпросмотр
            </Button>
            {!locked && (
              <Button loading={save.isPending} disabled={busy && !save.isPending} onClick={submit}>
                {current ? 'Сохранить' : 'Создать черновик'}
              </Button>
            )}
          </>
        }
      />

      {failure && <FormAlert>{serverMessage(failure)}</FormAlert>}
      {uploads.error && <FormAlert>{uploads.error}</FormAlert>}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-6">
          <Card className="flex flex-col gap-5">
            <Field label="Заголовок" required error={titleError}>
              <Input
                maxLength={200}
                value={draft.title}
                onChange={(event) => update({ title: event.target.value })}
              />
            </Field>
            <Field label="Анонс" hint="Пара предложений для карточки в ленте">
              <Textarea
                autoGrow
                minRows={2}
                maxLength={500}
                value={draft.summary ?? ''}
                onChange={(event) => update({ summary: event.target.value || null })}
              />
            </Field>
          </Card>

          <section className="flex flex-col gap-4" aria-label="Текст статьи">
            <h2 className="text-h3 font-medium">Текст статьи</h2>
            {draft.blocks.length > 0 && (
              <ol className="flex flex-col gap-3">
                {draft.blocks.map((block, index) => (
                  <BlockEditor
                    key={index}
                    block={block}
                    index={index}
                    count={draft.blocks.length}
                    slot={`block-${index}`}
                    uploads={uploads}
                    error={errors[index]}
                    onChange={(next) => setBlocks(draft.blocks.map((item, i) => (i === index ? next : item)))}
                    onMove={(offset) => {
                      const blocks = [...draft.blocks]
                      const [moved] = blocks.splice(index, 1)
                      blocks.splice(index + offset, 0, moved!)
                      setBlocks(blocks)
                    }}
                    onRemove={() => setBlocks(draft.blocks.filter((_, i) => i !== index))}
                  />
                ))}
              </ol>
            )}
            {!locked && (
              <AddBlockBar
                disabled={draft.blocks.length >= MAX_BLOCKS}
                onAdd={(type) => setBlocks([...draft.blocks, emptyBlock[type]])}
              />
            )}
          </section>
        </fieldset>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
          {current && (
            <Card className="flex flex-col gap-4">
              <StatusTag tone={statusTone[current.status]}>{statusTitles[current.status]}</StatusTag>
              <p className="text-sm text-muted">
                {current.status === 'published' && current.published_at
                  ? `На сайте с ${newsDate(current.published_at)}`
                  : `Изменена ${newsDate(current.updated_at)}`}
              </p>
              {current.status === 'published' && (
                <p className="text-sm text-muted">Сохранение сразу меняет статью на сайте</p>
              )}
              {locked && <p className="text-sm text-muted">Архивная статья только для чтения</p>}
              <div className="flex flex-col gap-2">
                {current.status === 'draft' && (
                  <Button
                    disabled={dirty || busy}
                    loading={transition.isPending && transition.variables === 'publish'}
                    onClick={() => setConfirming('publish')}
                  >
                    Опубликовать
                  </Button>
                )}
                {current.status === 'published' && (
                  <>
                    <Button variant="secondary" to={routes.newsArticle(current.slug)}>
                      Открыть на сайте
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={dirty || busy}
                      loading={transition.isPending && transition.variables === 'unpublish'}
                      onClick={() => setConfirming('unpublish')}
                    >
                      Снять с публикации
                    </Button>
                  </>
                )}
                {locked && (
                  <Button
                    loading={transition.isPending && transition.variables === 'restore'}
                    onClick={() => setConfirming('restore')}
                  >
                    Вернуть в черновики
                  </Button>
                )}
              </div>
              {dirty && !locked && <p className="text-sm text-live-text">Сначала сохраните изменения</p>}
            </Card>
          )}

          <Card className="flex flex-col gap-5">
            <fieldset disabled={locked} className="flex flex-col gap-5">
              {draft.cover_file_id ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-ink">Обложка</span>
                  <NewsCover fileId={draft.cover_file_id} className="rounded-lg" />
                  {!locked && (
                    <Button
                      variant="text"
                      size="sm"
                      className="self-start"
                      onClick={() => update({ cover_file_id: null })}
                    >
                      Убрать обложку
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <FileDrop
                    label="Обложка"
                    hint="JPEG, PNG или WebP, до 10 МБ"
                    accept="image/jpeg,image/png,image/webp"
                    value={null}
                    onChange={(file) =>
                      file && uploads.upload('cover', file, (fileId) => update({ cover_file_id: fileId }))
                    }
                  />
                  {uploads.loading('cover') && (
                    <span className="flex items-center gap-2 text-sm text-muted">
                      <Spinner className="size-4" /> Загружаем…
                    </span>
                  )}
                </div>
              )}
              <Field label="Раздел" hint="Например, «Соревнования» или «Обучение»">
                <Input
                  maxLength={100}
                  value={draft.section ?? ''}
                  onChange={(event) => update({ section: event.target.value || null })}
                />
              </Field>
              <Field label="Хэштеги" hint="Через запятую или пробел">
                <Input
                  value={tags}
                  onChange={(event) => {
                    setTags(event.target.value)
                    markDirty(true)
                  }}
                />
              </Field>
              {parseHashtags(tags).length > 0 && (
                <p className="-mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-primary-text">
                  {parseHashtags(tags).map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </p>
              )}
            </fieldset>
          </Card>
        </aside>
      </div>

      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        size="lg"
        title="Предпросмотр"
        description="Так статью увидят на сайте"
      >
        <article className="flex flex-col gap-6">
          <h1 className="text-h2 font-medium text-balance">{draft.title || 'Без заголовка'}</h1>
          {draft.summary && <p className="text-lead text-muted">{draft.summary}</p>}
          {draft.cover_file_id && <NewsCover fileId={draft.cover_file_id} className="rounded-xl" />}
          <ArticleContent
            blocks={draft.blocks.filter(
              (block) => !(block.type === 'image' || block.type === 'file') || block.file_id,
            )}
          />
        </article>
      </Modal>

      <ConfirmModal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={newsConfirmation[confirming ?? 'publish'].title}
        description={`«${current?.title ?? ''}». ${newsConfirmation[confirming ?? 'publish'].description}`}
        confirmLabel={newsConfirmation[confirming ?? 'publish'].label}
        onConfirm={async () => {
          if (confirming) await transition.mutateAsync(confirming)
        }}
      />

      <ConfirmModal
        open={blocker.state === 'blocked'}
        onClose={() => {
          if (blocker.state === 'blocked') blocker.reset()
        }}
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed()
        }}
        tone="danger"
        title="Уйти без сохранения?"
        description={
          uploads.busy ? 'Файл ещё загружается и не попадёт в статью' : 'Несохранённые изменения пропадут'
        }
        confirmLabel="Уйти"
        cancelLabel="Остаться"
      />
    </div>
  )
}
