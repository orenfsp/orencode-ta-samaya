import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import {
  documentApi,
  documentKeys,
  useMyDocuments,
  type DocumentKind,
  type MyDocument,
} from '@/entities/document'
import { useMe } from '@/entities/session'
import { PersonReportButton } from '@/features/person-report'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  IconDownload,
  IconSearch,
  Input,
  PageHeader,
  PlaceMark,
  Select,
  showToast,
  Toolbar,
  type Column,
} from '@/shared/ui'

/** Вид одного документа: в справочнике видов названия во множественном числе */
const kindTitles: Record<DocumentKind, string> = {
  certificate: 'Сертификат участника',
  diploma: 'Диплом призёра',
  gramota: 'Грамота',
  thanks: 'Благодарность тренеру',
  judge_thanks: 'Благодарность судье',
  reference: 'Справка об участии',
}

const isKind = (value: string | null): value is DocumentKind => value != null && value in kindTitles

const columns: Column<MyDocument>[] = [
  {
    key: 'document',
    header: 'Документ',
    primary: true,
    cell: (item) => (
      <span className="flex min-w-0 flex-col gap-0.5">
        <Link to={routes.document(item.token)} className="link-underline text-ink focus-visible:field-focus">
          {item.kind === 'reference' ? kindTitles.reference : item.title}
        </Link>
        <span className="text-xs text-muted">
          {kindTitles[item.kind]}
          {item.role === 'coach' ? ' · как тренер' : item.role === 'judge' ? ' · как судья' : ''}
        </span>
      </span>
    ),
  },
  {
    key: 'contest',
    header: 'Соревнование',
    cell: (item) => (
      <span className="flex min-w-0 flex-col gap-0.5">
        <Link
          to={routes.competition(item.contest.id)}
          className="link-underline text-sm text-ink focus-visible:field-focus"
        >
          {item.contest.title}
        </Link>
        <span className="font-mono text-xs text-muted">{item.contest.dates}</span>
      </span>
    ),
  },
  {
    key: 'place',
    header: 'Место',
    width: 'w-24',
    cell: (item) =>
      item.place ? <PlaceMark place={item.place} size="sm" /> : <span className="text-muted">—</span>,
  },
  {
    key: 'number',
    header: 'Номер',
    hideBelow: 'xl',
    width: 'w-36',
    cell: (item) => <span className="font-mono text-sm text-muted">{item.number}</span>,
  },
  {
    key: 'issued',
    header: 'Выдан',
    sortable: true,
    width: 'w-32',
    cell: (item) => (
      <span className="font-mono text-sm text-muted tabular-nums">{formatDate(item.issued_on)}</span>
    ),
  },
  {
    key: 'pdf',
    header: <span className="sr-only">Скачать</span>,
    actions: true,
    cell: (item) => (
      <Button
        variant="secondary"
        size="sm"
        leftIcon={<IconDownload size={16} />}
        href={documentApi.pdfUrl(item.token)}
      >
        PDF
      </Button>
    ),
  },
]

/** Мои документы: таблица с поиском, видом и порядком по дате выдачи; справку об участии можно получить самому */
export function CabinetDocumentsPage() {
  const { role = 'athlete' } = useParams()
  const [params, setParams] = useSearchParams()
  const sort = params.get('sort') === 'old' ? 'old' : 'new'
  const kindParam = params.get('kind')
  const kind = isKind(kindParam) ? kindParam : undefined
  const search = params.get('q') ?? ''
  const documents = useMyDocuments({ sort, kind })
  const { data: me } = useMe()
  const client = useQueryClient()
  const request = useMutation({
    mutationFn: (contestId: number) => documentApi.requestReference(contestId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: documentKeys.all })
      showToast('Справка готова', { tone: 'success' })
    },
    onError: (error) =>
      showToast('Не получилось выдать справку', { tone: 'danger', description: error.message }),
  })

  const update = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  const needle = search.trim().toLowerCase()
  const items = (documents.data?.items ?? []).filter(
    (item) =>
      !needle ||
      item.title.toLowerCase().includes(needle) ||
      item.contest.title.toLowerCase().includes(needle),
  )
  const available = documents.data?.available ?? []
  const filtered = Boolean(kind || needle)

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Мои документы"
        description="Сертификаты, дипломы и грамоты выпускает организатор. Справку об участии можно получить самому"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole(role) },
          { label: 'Мои документы' },
        ]}
        actions={me && <PersonReportButton userId={me.id} />}
      />

      {available.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-primary/50 bg-primary-soft p-4 sm:p-5">
          <h2 className="text-body font-medium text-ink">Можно получить справку об участии</h2>
          <ul className="flex flex-col divide-y divide-line-soft">
            {available.map(({ contest }) => (
              <li key={contest.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <Link to={routes.competition(contest.id)} className="truncate link-underline text-ink">
                    {contest.title}
                  </Link>
                  <span className="font-mono text-xs text-muted">{contest.dates}</span>
                </span>
                <Button
                  size="sm"
                  loading={request.isPending && request.variables === contest.id}
                  disabled={request.isPending}
                  onClick={() => request.mutate(contest.id)}
                >
                  Получить справку
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Toolbar
        search={
          <Field label="Поиск">
            <Input
              type="search"
              leftIcon={<IconSearch size={18} />}
              placeholder="Название или соревнование"
              value={search}
              onChange={(event) => update('q', event.target.value)}
            />
          </Field>
        }
        end={
          filtered && (
            <Button
              variant="ghost"
              onClick={() => setParams(sort === 'old' ? { sort } : {}, { replace: true })}
            >
              Сбросить
            </Button>
          )
        }
      >
        <Field label="Вид">
          <Select
            value={kind ?? ''}
            onChange={(event) => update('kind', event.target.value)}
            options={[
              { value: '', label: 'Все виды' },
              ...(Object.entries(kindTitles) as [DocumentKind, string][]).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
        </Field>
        <Field label="Порядок">
          <Select
            value={sort}
            onChange={(event) => update('sort', event.target.value === 'old' ? 'old' : '')}
            options={[
              { value: 'new', label: 'Сначала новые' },
              { value: 'old', label: 'Сначала старые' },
            ]}
          />
        </Field>
      </Toolbar>

      {documents.isError && !documents.data ? (
        <ErrorState error={documents.error} onRetry={() => documents.refetch()} />
      ) : (
        <DataTable
          caption="Мои документы"
          columns={columns}
          rows={items}
          rowKey={(item) => item.token}
          loading={documents.isPending}
          skeletonRows={5}
          sort={{ key: 'issued', dir: sort === 'old' ? 'asc' : 'desc' }}
          onSort={(_, dir) => update('sort', dir === 'asc' ? 'old' : '')}
          empty={
            filtered ? (
              <EmptyState
                title="Ничего не нашли"
                description="Измените поиск или вид документа"
                action={
                  <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                    Сбросить
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="Документов пока нет"
                action={
                  <Button variant="secondary" to={routes.cabinetCompetitions(role)}>
                    Соревнования
                  </Button>
                }
              />
            )
          }
        />
      )}
    </section>
  )
}
