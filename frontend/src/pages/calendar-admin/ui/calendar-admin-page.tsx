import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import {
  calendarApi,
  EventCard,
  todayOrenburg,
  type CalendarEvent,
  type EventInput,
} from '@/entities/calendar'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import { fromLocalInput, toLocalInput } from '@/shared/lib'
import {
  Button,
  Card,
  Checkbox,
  DateTimeInput,
  Drawer,
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
  Modal,
  PageHeader,
  Skeleton,
  Textarea,
  showToast,
  type StatusTone,
} from '@/shared/ui'

const statusLabels = { draft: 'Черновик', published: 'Опубликовано', archived: 'В архиве' }
const statusTones: Record<CalendarEvent['status'], StatusTone> = {
  draft: 'draft',
  published: 'active',
  archived: 'done',
}

/** Форма события — в той же боковой панели, что и форма соревнования: одна механика правки во всём кабинете */
function EventEditor({
  open,
  event,
  onClose,
  onSaved,
}: {
  open: boolean
  event: CalendarEvent | null
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<EventInput>(() =>
    event
      ? {
          title: event.title,
          description: event.description,
          starts_at: toLocalInput(event.starts_at),
          ends_at: toLocalInput(event.ends_at),
          location: event.location,
          is_online: event.is_online,
          registration_url: event.registration_url,
        }
      : {
          title: '',
          description: '',
          starts_at: `${todayOrenburg()}T10:00`,
          ends_at: `${todayOrenburg()}T12:00`,
          location: null,
          is_online: false,
          registration_url: null,
        },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: (body: EventInput) => (event ? calendarApi.update(event.id, body) : calendarApi.create(body)),
    onSuccess: () => {
      showToast(event ? 'Событие сохранено' : 'Черновик создан', { tone: 'success' })
      onSaved()
    },
  })
  const update = <K extends keyof EventInput>(key: K, value: EventInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
    save.reset()
  }
  const server = save.error instanceof ApiError ? save.error : null
  const fieldError = (key: string) => errors[key] || server?.field(key)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found: Record<string, string> = {}
    if (!draft.title.trim()) found.title = 'Введите название'
    if (!draft.starts_at) found.starts_at = 'Укажите дату и время начала'
    if (!draft.ends_at) found.ends_at = 'Укажите дату и время окончания'
    else if (draft.starts_at && draft.ends_at <= draft.starts_at)
      found.ends_at = 'Окончание должно быть позже начала'
    if (!draft.is_online && !draft.location?.trim())
      found.location = 'Укажите место или выберите онлайн-формат'
    setErrors(found)
    if (Object.keys(found).length) return
    save.mutate({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      starts_at: fromLocalInput(draft.starts_at),
      ends_at: fromLocalInput(draft.ends_at),
      location: draft.location?.trim() || null,
      registration_url: draft.registration_url?.trim() || null,
    })
  }
  return (
    <Drawer
      open={open}
      onClose={save.isPending ? () => {} : onClose}
      onSubmit={submit}
      title={event ? event.title : 'Новое событие ФСП'}
      description={event ? statusLabels[event.status] : 'Сохранится черновиком'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending}>
            {event ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {save.isError && (
          <FormAlert>
            {save.error.message}
            {server?.fields.__root__ && `: ${server.fields.__root__.join('. ')}`}
          </FormAlert>
        )}
        <Field label="Название" required error={fieldError('title')}>
          <Input
            autoFocus
            maxLength={300}
            value={draft.title}
            onChange={(e) => update('title', e.target.value)}
          />
        </Field>
        <Field label="Описание" error={fieldError('description')}>
          <Textarea
            minRows={4}
            maxLength={20000}
            value={draft.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="О чём событие, для кого и как принять участие"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Начало" required hint="Время Оренбурга" error={fieldError('starts_at')}>
            <DateTimeInput value={draft.starts_at} onChange={(value) => update('starts_at', value)} />
          </Field>
          <Field label="Окончание" required error={fieldError('ends_at')}>
            <DateTimeInput
              min={draft.starts_at || undefined}
              value={draft.ends_at}
              onChange={(value) => update('ends_at', value)}
            />
          </Field>
        </div>
        <Checkbox
          label="Онлайн-событие"
          checked={draft.is_online}
          onChange={(e) => update('is_online', e.target.checked)}
        />
        <Field
          label={draft.is_online ? 'Площадка или дополнительные сведения' : 'Место проведения'}
          required={!draft.is_online}
          error={fieldError('location')}
        >
          <Input
            maxLength={500}
            value={draft.location ?? ''}
            onChange={(e) => update('location', e.target.value || null)}
            placeholder="Город, адрес или название площадки"
          />
        </Field>
        <Field
          label="Ссылка на регистрацию"
          hint="Необязательно. Ссылка откроется на внешнем сайте"
          error={fieldError('registration_url')}
        >
          <Input
            type="url"
            maxLength={2048}
            value={draft.registration_url ?? ''}
            onChange={(e) => update('registration_url', e.target.value || null)}
            placeholder="https://"
          />
        </Field>
      </div>
    </Drawer>
  )
}

/** Раздел «Календарь» кабинета федерации: свои события ФСП (не соревнования) */
export function CalendarAdminPage() {
  const client = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [editor, setEditor] = useState<{ open: boolean; event: CalendarEvent | null; key: number }>({
    open: false,
    event: null,
    key: 0,
  })
  const edit = (event: CalendarEvent | null) =>
    setEditor((current) => ({ open: true, event, key: current.key + 1 }))
  const [archive, setArchive] = useState<CalendarEvent | null>(null)
  const events = useQuery({
    queryKey: ['calendar', 'admin', q, page],
    queryFn: () => calendarApi.adminList({ q, offset: page * 20, limit: 20 }),
  })
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['calendar'] })
  }
  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'publish' | 'unpublish' | 'archive' }) =>
      calendarApi.transition(id, action),
    onSuccess: async () => {
      showToast('Статус события обновлён', { tone: 'success' })
      await refresh()
    },
  })
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('federation') },
          { label: 'События' },
        ]}
        title="События ФСП"
        description="Лекции, сборы и вебинары федерации. Опубликованные видны в общем календаре"
        actions={
          <Button leftIcon={<IconPlus size={18} />} onClick={() => edit(null)}>
            Создать событие
          </Button>
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-xl">
          <Field label="Поиск по своим событиям">
            <Input
              type="search"
              maxLength={300}
              leftIcon={<IconSearch size={18} />}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
            />
          </Field>
        </div>
        <Button to={routes.calendar} variant="secondary">
          Публичный календарь
        </Button>
      </div>
      {transition.isError && <FormAlert>{transition.error.message}</FormAlert>}
      {events.isPending ? (
        <div className="grid gap-4 min-[1920px]:grid-cols-4 sm:grid-cols-2 2xl:grid-cols-3">
          {[1, 2, 3].map((id) => (
            <Skeleton key={id} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => events.refetch()} />
      ) : (
        <>
          {!events.data.items.length && (
            <Card>
              <EmptyState
                title={q ? 'Ничего не найдено' : 'Своих событий пока нет'}
                description={q ? 'Измените поисковый запрос' : 'Новое событие сохранится черновиком'}
              />
            </Card>
          )}
          <div className="grid gap-4 min-[1920px]:grid-cols-4 sm:grid-cols-2 2xl:grid-cols-3">
            {events.data.items.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                status={{ tone: statusTones[event.status], title: statusLabels[event.status] }}
                footer={
                  <div className="flex items-center gap-2 border-t border-line-soft pt-4">
                    {event.status !== 'archived' && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => edit(event)}>
                          Изменить
                        </Button>
                        <Button
                          size="sm"
                          variant={event.status === 'draft' ? 'primary' : 'outline'}
                          loading={transition.isPending && transition.variables?.id === event.id}
                          disabled={transition.isPending}
                          onClick={() =>
                            transition.mutate({
                              id: event.id,
                              action: event.status === 'draft' ? 'publish' : 'unpublish',
                            })
                          }
                        >
                          {event.status === 'draft' ? 'Опубликовать' : 'Снять'}
                        </Button>
                      </>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      {event.status === 'published' && (
                        <IconButton
                          aria-label="Открыть в календаре"
                          size="sm"
                          icon={<IconExternal size={18} />}
                          to={`${routes.calendar}/${event.id}`}
                        />
                      )}
                      {event.status !== 'archived' && (
                        <IconButton
                          aria-label="В архив"
                          size="sm"
                          icon={<IconArchive size={18} />}
                          disabled={transition.isPending}
                          onClick={() => {
                            transition.reset()
                            setArchive(event)
                          }}
                        />
                      )}
                    </span>
                  </div>
                }
              />
            ))}
          </div>
          {events.data.total > 20 && (
            <div className="flex items-center justify-center gap-4">
              <Button variant="secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
                Назад
              </Button>
              <span className="text-sm text-muted">
                {page + 1} / {Math.ceil(events.data.total / 20)}
              </span>
              <Button
                variant="secondary"
                disabled={(page + 1) * 20 >= events.data.total}
                onClick={() => setPage((value) => value + 1)}
              >
                Дальше
              </Button>
            </div>
          )}
        </>
      )}
      <EventEditor
        key={editor.key}
        open={editor.open}
        event={editor.event}
        onClose={() => setEditor((current) => ({ ...current, open: false }))}
        onSaved={() => {
          setEditor((current) => ({ ...current, open: false }))
          void refresh()
        }}
      />
      <Modal
        open={Boolean(archive)}
        onClose={transition.isPending ? () => {} : () => setArchive(null)}
        title="Архивировать событие?"
        description={`«${archive?.title ?? ''}» исчезнет из публичного календаря. Архивное событие останется в этом списке без возможности редактирования.`}
        footer={
          <>
            <Button variant="ghost" disabled={transition.isPending} onClick={() => setArchive(null)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              loading={transition.isPending}
              onClick={() => {
                if (archive)
                  transition.mutate(
                    { id: archive.id, action: 'archive' },
                    { onSuccess: () => setArchive(null) },
                  )
              }}
            >
              В архив
            </Button>
          </>
        }
      >
        {transition.isError && <FormAlert>{transition.error.message}</FormAlert>}
      </Modal>
    </div>
  )
}
