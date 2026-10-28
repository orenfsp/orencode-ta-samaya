import { useSearchParams } from 'react-router'
import {
  calendarDays,
  dayLabel,
  monthBounds,
  monthLabel,
  moveMonth,
  todayOrenburg,
  useCalendarEvents,
} from '@/entities/calendar'
import { routes } from '@/shared/config'
import { cn, plural } from '@/shared/lib'
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  Input,
  PageHeader,
  Select,
  Skeleton,
} from '@/shared/ui'
import { Agenda } from '@/widgets/calendar-events'

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

type DatedEvent = { id: string; start_date: string; end_date: string | null }

/** Ближайшее ещё не прошедшее событие — наверх, остальные по возрастанию даты начала */
function nearestFirst<T extends DatedEvent>(events: T[], today: string) {
  const sorted = [...events].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const nearest = sorted.find((event) => (event.end_date ?? event.start_date) >= today)
  if (!nearest) return { list: sorted, nearestId: null }
  return { list: [nearest, ...sorted.filter((event) => event !== nearest)], nearestId: nearest.id }
}

export function CalendarPage() {
  const [params, setParams] = useSearchParams()
  const today = todayOrenburg()
  const rawMonth = params.get('month') ?? ''
  const month = /^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : today.slice(0, 7)
  const rawDay = params.get('day') ?? ''
  const [from, to] = monthBounds(month)
  const day = /^\d{4}-\d{2}-\d{2}$/.test(rawDay) && rawDay >= from && rawDay <= to ? rawDay : ''
  const kind = ['event', 'contest'].includes(params.get('kind') ?? '') ? params.get('kind')! : ''
  const q = (params.get('q') ?? '').slice(0, 300)
  const events = useCalendarEvents(from, to, kind, q)
  const update = (values: Record<string, string>, replace = false) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        Object.entries(values).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
        return next
      },
      { replace },
    )
  }
  const items = events.data?.items ?? []
  const filtered = day
    ? items.filter((event) => event.start_date <= day && (event.end_date ?? event.start_date) >= day)
    : items
  const { list: visible, nearestId } = nearestFirst(filtered, today)
  const days = calendarDays(month)

  const pick = (date: string) => {
    const next = day === date ? '' : date
    update({ day: next })
  }

  return (
    <div className="container-page flex flex-col gap-8 py-8 sm:py-12">
      <PageHeader
        crumbs={[{ label: 'Главная', to: routes.home }, { label: 'Календарь' }]}
        title="Календарь"
        description="Соревнования по спортивному программированию и события федерации: лекции, сборы, вебинары"
      />

      <div className="grid items-start gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-28">
          <section className="card p-4" aria-label={monthLabel(month)} aria-busy={events.isFetching}>
            <div className="flex items-center gap-1">
              <IconButton
                aria-label="Предыдущий месяц"
                size="sm"
                icon={<IconChevronLeft size={18} />}
                disabled={month === '1900-01'}
                onClick={() => update({ month: moveMonth(month, -1), day: '' })}
              />
              <span className="flex-1 text-center font-mono text-body text-ink first-letter:uppercase">
                {monthLabel(month)}
              </span>
              <IconButton
                aria-label="Следующий месяц"
                size="sm"
                icon={<IconChevronRight size={18} />}
                disabled={month === '2100-12'}
                onClick={() => update({ month: moveMonth(month, 1), day: '' })}
              />
            </div>
            <div className="mt-3 grid grid-cols-7 gap-y-1">
              {weekdays.map((label, index) => (
                <span
                  key={label}
                  className={cn('py-1 text-center font-mono text-xs', index >= 5 ? 'text-muted' : 'text-ink')}
                >
                  {label}
                </span>
              ))}
              {days.map((date) => {
                const dayItems = items.filter(
                  (event) => event.start_date <= date && (event.end_date ?? event.start_date) >= date,
                )
                const count = dayItems.length
                const inMonth = date.startsWith(month)
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={!inMonth}
                    onClick={() => pick(date)}
                    aria-pressed={day === date}
                    aria-label={`${dayLabel(date)}${count ? `, ${count} ${plural(count, ['событие', 'события', 'событий'])}` : ', нет событий'}`}
                    className={cn(
                      'mx-auto flex size-10 flex-col items-center justify-center gap-0.5 rounded-md font-mono text-sm transition-colors',
                      !inMonth && 'opacity-25',
                      inMonth && 'hover:bg-hover-tint',
                      count === 0 && inMonth && 'text-muted',
                      count > 0 && 'text-ink',
                      date === today && 'ring-2 ring-live ring-inset',
                      day === date && 'bg-primary text-white hover:bg-primary',
                    )}
                  >
                    {Number(date.slice(-2))}
                    <span className="flex h-1 gap-0.5" aria-hidden="true">
                      {dayItems.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className={cn(
                            'size-1 rounded-full',
                            day === date ? 'bg-white' : event.kind === 'contest' ? 'bg-primary' : 'bg-live',
                          )}
                        />
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
              <span className="flex items-center gap-3 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" /> Соревнование
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-live" aria-hidden="true" /> Событие ФСП
                </span>
              </span>
              <Button
                variant="text"
                size="sm"
                onClick={() => update({ month: today.slice(0, 7), day: today })}
              >
                Сегодня
              </Button>
            </div>
          </section>

          <div className="flex flex-col gap-3 card p-4">
            <Field label="Поиск по названию">
              <Input
                type="search"
                maxLength={300}
                placeholder="Соревнование или событие"
                leftIcon={<IconSearch size={18} />}
                value={q}
                onChange={(event) => update({ q: event.target.value, day: '' }, true)}
              />
            </Field>
            <Field label="Что показывать">
              <Select
                value={kind}
                onChange={(event) => update({ kind: event.target.value, day: '' })}
                options={[
                  { value: '', label: 'Всё' },
                  { value: 'contest', label: 'Соревнования' },
                  { value: 'event', label: 'События ФСП' },
                ]}
              />
            </Field>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col gap-5" aria-label="События периода">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-h2 font-medium first-letter:uppercase">
                {day ? dayLabel(day) : monthLabel(month)}
              </h2>
              {events.data && (
                <span className="font-mono text-sm text-muted tabular-nums">
                  {visible.length} {plural(visible.length, ['запись', 'записи', 'записей'])}
                </span>
              )}
            </div>
            {day && (
              <Button variant="secondary" size="sm" onClick={() => update({ day: '' })}>
                Весь месяц
              </Button>
            )}
          </div>
          {events.isPending ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((id) => (
                <Skeleton key={id} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : events.isError ? (
            <ErrorState error={events.error} onRetry={() => events.refetch()} />
          ) : visible.length ? (
            <Agenda items={visible} from={day || from} highlightId={nearestId} />
          ) : (
            <div className="card">
              <EmptyState
                icon={<IconCalendar size={26} />}
                title={day ? 'В этот день ничего нет' : 'В этом месяце ничего нет'}
                description="Выберите другой месяц или измените фильтры"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
