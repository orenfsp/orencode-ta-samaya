import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  deadlineKindTitles,
  useMyDeadlines,
  useReportDeadlines,
  type Deadline,
  type ReportDeadline,
} from '@/entities/deadline'
import { ReportDeadlineModal } from '@/features/report-deadlines'
import { routes } from '@/shared/config'
import { formatDate, plural } from '@/shared/lib'
import {
  Button,
  EmptyState,
  ErrorState,
  IconPlus,
  PageHeader,
  SectionHeader,
  Skeleton,
  StatusTag,
  Switch,
  type StatusTone,
} from '@/shared/ui'

const day = (value: string) => formatDate(`${value}T12:00:00Z`)

function left(days: number): { tone: StatusTone; label: string } {
  if (days < 0)
    return { tone: 'cancelled', label: `Просрочено на ${-days} ${plural(-days, ['день', 'дня', 'дней'])}` }
  if (days === 0) return { tone: 'live', label: 'Сегодня' }
  if (days <= 7) return { tone: 'live', label: `Через ${days} ${plural(days, ['день', 'дня', 'дней'])}` }
  return { tone: 'active', label: `Через ${days} ${plural(days, ['день', 'дня', 'дней'])}` }
}

function Row({ item }: { item: Deadline }) {
  const state = left(item.days_left)
  return (
    <li>
      <Link
        to={item.link}
        className="flex flex-wrap items-center gap-x-4 gap-y-1 field-focus px-4 py-3 transition-colors hover:bg-hover-tint sm:px-5"
      >
        <span className="w-24 shrink-0 font-mono text-sm text-muted tabular-nums">{day(item.due)}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-ink">{item.title}</span>
          <span className="text-sm text-muted">
            {deadlineKindTitles[item.kind]} · {item.detail}
          </span>
        </span>
        <StatusTag tone={state.tone}>{state.label}</StatusTag>
      </Link>
    </li>
  )
}

function Reports() {
  const [showDone, setShowDone] = useState(false)
  const reports = useReportDeadlines(showDone)
  const [form, setForm] = useState<{ open: boolean; item: ReportDeadline | null; key: number }>({
    open: false,
    item: null,
    key: 0,
  })
  const open = (item: ReportDeadline | null) => setForm((state) => ({ open: true, item, key: state.key + 1 }))
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Отчётные сроки"
        action={
          <Button variant="secondary" size="sm" leftIcon={<IconPlus size={18} />} onClick={() => open(null)}>
            Добавить
          </Button>
        }
      />
      <Switch
        label="Показать сданные"
        checked={showDone}
        onChange={(event) => setShowDone(event.target.checked)}
      />
      {reports.isPending ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : reports.isError ? (
        <ErrorState error={reports.error} onRetry={() => reports.refetch()} />
      ) : !reports.data.length ? (
        <p className="text-muted">Отчётных сроков нет</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
          {reports.data.map((item) => {
            const state = item.done_at ? { tone: 'done' as const, label: 'Сдан' } : left(item.days_left)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => open(item)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 field-focus px-4 py-3 text-left transition-colors hover:bg-hover-tint sm:px-5"
                >
                  <span className="w-24 shrink-0 font-mono text-sm text-muted tabular-nums">
                    {day(item.due_on)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-ink">{item.title}</span>
                    {item.recipient && <span className="text-sm text-muted">{item.recipient}</span>}
                  </span>
                  <StatusTag tone={state.tone}>{state.label}</StatusTag>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <ReportDeadlineModal
        key={form.key}
        open={form.open}
        item={form.item}
        onClose={() => setForm((state) => ({ ...state, open: false }))}
      />
    </section>
  )
}

/** Сроки в пределах роли: приём заявок, разряды и категории, антидопинг; у федерации — премии и отчёты */
export function CabinetDeadlinesPage() {
  const { role = 'athlete' } = useParams()
  const deadlines = useMyDeadlines()
  const items = deadlines.data ?? []
  const urgent = items.filter((item) => item.days_left <= 7)
  const later = items.filter((item) => item.days_left > 7)

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        title="Сроки"
        description="На 60 дней вперёд. О каждом сроке приходит напоминание"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole(role) },
          { label: 'Сроки' },
        ]}
      />
      {deadlines.isPending ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((id) => (
            <Skeleton key={id} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : deadlines.isError ? (
        <ErrorState error={deadlines.error} onRetry={() => deadlines.refetch()} />
      ) : !items.length ? (
        <EmptyState
          title="Ближайших сроков нет"
          description="Здесь появятся приём заявок, сроки разряда и категории"
        />
      ) : (
        [
          { title: 'Ближайшая неделя', list: urgent },
          { title: 'Позже', list: later },
        ].map(
          (group) =>
            group.list.length > 0 && (
              <section key={group.title} className="flex flex-col gap-3">
                <h2 className="text-h3 font-medium">{group.title}</h2>
                <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
                  {group.list.map((item) => (
                    <Row key={`${item.kind}-${item.title}-${item.due}`} item={item} />
                  ))}
                </ul>
              </section>
            ),
        )
      )}
      {role === 'federation' && <Reports />}
    </section>
  )
}
