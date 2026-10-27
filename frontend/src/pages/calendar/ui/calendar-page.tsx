import { useState } from 'react'
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
  Breadcrumbs,
  Button,
  Field,
  IconButton,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  Input,
  monthNames,
  Select,
  Skeleton,
  ErrorState,
  Tabs,
} from '@/shared/ui'
import { EventList } from '@/widgets/calendar-events'

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/** Годы вокруг текущего и выбранного: длинный список 1900–2100 в выпадашке не нужен */
function years(selected: number) {
  const now = new Date().getFullYear()
  const from = Math.max(1900, Math.min(selected, now - 5))
  const to = Math.min(2100, Math.max(selected, now + 5))
  return Array.from({ length: to - from + 1 }, (_, index) => from + index)
}

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
  const [defaultView] = useState(() => (window.matchMedia('(max-width: 767px)').matches ? 'list' : 'month'))
  const view = ['month', 'list'].includes(params.get('view') ?? '') ? params.get('view')! : defaultView
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

  return (
    <div className="container-page flex flex-col gap-8 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: 'Главная', to: routes.home }, { label: 'Календарь' }]} />
      <header className="flex flex-col gap-3">
        <h1 className="text-h1 font-medium">Календарь</h1>
        <p className="max-w-2xl text-lead text-muted">
          Соревнования по спортивному программированию и события федерации: лекции, сборы, вебинары.
        </p>
      </header>
      {/* Панель: месяц и вид слева, поиск и «что показывать» справа; на телефоне — столбиком */}
      <div className="flex flex-col gap-4 rounded-xl border border-line-soft bg-surface p-3 sm:p-5 xl:flex-row xl:items-end">
        {/* Строка месяца не переносится: стрелки по краям, выпадашки тянутся между ними */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex min-w-0 items-center gap-1.5 sm:w-[24rem] sm:gap-2">
            <IconButton
              aria-label="Предыдущий месяц"
              variant="secondary"
              size="sm"
              className="h-11 w-9 sm:size-11"
              icon={<IconChevronLeft size={18} />}
              disabled={month === '1900-01'}
              onClick={() => update({ month: moveMonth(month, -1), day: '' })}
            />
            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_5.5rem] gap-1.5 sm:grid-cols-[minmax(0,1fr)_6.5rem] sm:gap-2">
              <Select
                aria-label="Месяц"
                value={month.slice(5, 7)}
                onChange={(event) => update({ month: `${month.slice(0, 4)}-${event.target.value}`, day: '' })}
                options={monthNames.map((name, index) => ({
                  value: String(index + 1).padStart(2, '0'),
                  label: name,
                }))}
              />
              <Select
                aria-label="Год"
                value={month.slice(0, 4)}
                onChange={(event) => update({ month: `${event.target.value}-${month.slice(5, 7)}`, day: '' })}
                options={years(Number(month.slice(0, 4))).map((year) => ({
                  value: String(year),
                  label: String(year),
                }))}
              />
            </div>
            <IconButton
              aria-label="Следующий месяц"
              variant="secondary"
              size="sm"
              className="h-11 w-9 sm:size-11"
              icon={<IconChevronRight size={18} />}
              disabled={month === '2100-12'}
              onClick={() => update({ month: moveMonth(month, 1), day: '' })}
            />
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => update({ month: today.slice(0, 7), day: today })}>
              Сегодня
            </Button>
            <Tabs
              aria-label="Вид календаря"
              value={view}
              onChange={(value) => update({ view: value })}
              items={[
                { value: 'month', label: 'Месяц' },
                { value: 'list', label: 'Список' },
              ]}
            />
          </div>
        </div>
        <div className="grid flex-1 gap-4 sm:grid-cols-[minmax(0,1fr)_13rem] xl:ml-auto xl:max-w-xl">
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
      </div>

      {view === 'month' && (
        <section
          className="overflow-hidden rounded-xl border border-line-soft bg-surface"
          aria-label={monthLabel(month)}
          aria-busy={events.isFetching}
        >
          <div className="grid grid-cols-7 border-b border-line-soft bg-surface-2 light:bg-surface-3">
            {weekdays.map((label, index) => (
              <span
                key={label}
                className={cn(
                  'px-2 py-2.5 text-center font-mono text-xs md:text-left',
                  index >= 5 && 'text-muted',
                )}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((date, index) => {
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
                  onClick={() => update({ day: day === date ? '' : date })}
                  aria-pressed={day === date}
                  aria-label={`${dayLabel(date)}${count ? `, ${count} ${plural(count, ['событие', 'события', 'событий'])}` : ', нет событий'}`}
                  className={cn(
                    'relative flex min-h-14 flex-col items-center gap-1.5 border-r border-b border-line-soft p-1.5 text-left text-sm transition-colors md:min-h-28 md:items-stretch md:p-2 2xl:min-h-32',
                    index % 7 === 6 && 'border-r-0',
                    index >= days.length - 7 && 'border-b-0',
                    !inMonth && 'bg-canvas text-muted opacity-40',
                    inMonth && 'hover:bg-surface-2 light:hover:bg-surface-3',
                    day === date && 'bg-primary-soft ring-1 ring-primary ring-inset hover:bg-primary-soft',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-full font-mono',
                      date === today && 'text-live-text ring-2 ring-live ring-inset',
                    )}
                  >
                    {Number(date.slice(-2))}
                  </span>
                  {/* Телефон — точки; шире — названия: синяя полоса у соревнований, серая у событий */}
                  <span className="flex h-1.5 gap-0.5 md:hidden" aria-hidden="true">
                    {dayItems.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className={cn(
                          'size-1.5 rounded-full',
                          event.kind === 'contest' ? 'bg-primary' : 'bg-live',
                        )}
                      />
                    ))}
                  </span>
                  <span className="hidden min-w-0 flex-col gap-1 md:flex" aria-hidden="true">
                    {dayItems.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className={cn(
                          'truncate rounded-sm border-l-2 bg-surface-3 py-0.5 pr-1 pl-1.5 text-xs',
                          event.kind === 'contest' ? 'border-primary' : 'border-live',
                        )}
                      >
                        {event.title}
                      </span>
                    ))}
                    {count > 2 && <span className="pl-1.5 font-mono text-xs text-muted">+{count - 2}</span>}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-soft px-4 py-3 text-xs text-muted">
            <span className="flex items-center gap-2">
              <span className="h-3 w-0.5 bg-primary" aria-hidden="true" /> Соревнование
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-0.5 bg-live" aria-hidden="true" /> Событие ФСП
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-full ring-2 ring-live ring-inset" aria-hidden="true" />{' '}
              Сегодня
            </span>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-5" aria-label="События периода">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-h3 font-medium first-letter:uppercase">
              {day ? dayLabel(day) : monthLabel(month)}
            </h2>
            {events.data && (
              <span className="font-mono text-sm text-muted">
                {visible.length} {plural(visible.length, ['запись', 'записи', 'записей'])}
              </span>
            )}
          </div>
          {day && (
            <Button variant="text" onClick={() => update({ day: '' })}>
              Весь месяц
            </Button>
          )}
        </div>
        {events.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((id) => (
              <Skeleton key={id} className="h-56 rounded-lg" />
            ))}
          </div>
        ) : events.isError ? (
          <ErrorState error={events.error} onRetry={() => events.refetch()} />
        ) : (
          <EventList items={visible} highlightId={nearestId} />
        )}
      </section>
    </div>
  )
}
