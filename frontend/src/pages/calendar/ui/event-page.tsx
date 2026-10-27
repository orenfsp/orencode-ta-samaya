import { useParams } from 'react-router'
import { eventDates, useCalendarEvent } from '@/entities/calendar'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import {
  KindTag,
  MetaTag,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconCalendar,
  IconExternal,
  IconMapPin,
  Skeleton,
} from '@/shared/ui'

export function EventPage() {
  const { id = '' } = useParams()
  const event = useCalendarEvent(id)
  if (event.isPending)
    return (
      <div className="container-page py-12">
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  if (event.isError)
    return (
      <div className="container-page py-12">
        {event.error instanceof ApiError && [404, 422].includes(event.error.status) ? (
          <EmptyState
            title="Событие не найдено"
            description="Возможно, оно ещё не опубликовано или уже архивировано"
            action={<Button to={routes.calendar}>Вернуться в календарь</Button>}
          />
        ) : (
          <ErrorState error={event.error} onRetry={() => event.refetch()} />
        )}
      </div>
    )
  const item = event.data
  return (
    <article className="container-page flex max-w-4xl flex-col gap-8 py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { label: 'Главная', to: routes.home },
          { label: 'Календарь', to: routes.calendar },
          { label: item.title },
        ]}
      />
      <header className="flex flex-col items-start gap-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <KindTag kind="event" />
          <MetaTag accent={item.is_online}>{item.is_online ? 'Онлайн' : 'Оффлайн'}</MetaTag>
        </div>
        <h1 className="text-h1 font-medium break-words">{item.title}</h1>
      </header>
      <Card className="flex flex-col gap-4">
        <p className="flex items-start gap-3">
          <IconCalendar className="shrink-0" />
          {eventDates(item)}
        </p>
        {(item.location || item.is_online) && (
          <p className="flex items-start gap-3">
            <IconMapPin className="shrink-0" />
            {[item.is_online && 'Онлайн', item.location].filter(Boolean).join(' · ')}
          </p>
        )}
      </Card>
      {item.description ? (
        <p className="text-body leading-relaxed break-words whitespace-pre-wrap text-muted">
          {item.description}
        </p>
      ) : (
        <p className="text-body text-muted">Организатор пока не добавил описание события.</p>
      )}
      <div className="flex flex-wrap gap-3">
        {item.registration_url && (
          <a
            href={item.registration_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 py-2 text-white"
          >
            Перейти к регистрации <IconExternal size={18} />
          </a>
        )}
        <Button to={routes.calendar} variant="secondary">
          В календарь
        </Button>
      </div>
    </article>
  )
}
