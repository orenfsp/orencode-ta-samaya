import { useNavigate } from 'react-router'
import { useDictionaryOptions } from '@/entities/dictionary'
import {
  registryApi,
  useRegistryCoaches,
  useRegistryJudges,
  type CategoryState,
  type RegistryCoach,
  type RegistryJudge,
} from '@/entities/registry'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import {
  Button,
  IconDownload,
  Field,
  IconSearch,
  Input,
  Select,
  StatusTag,
  Toolbar,
  type Column,
  type StatusTone,
} from '@/shared/ui'
import { RegistryTable } from './registry-table'
import { PAGE, toId, useRegistryParams } from './use-params'

const STATES: Record<CategoryState, { label: string; tone: StatusTone }> = {
  valid: { label: 'Действует', tone: 'active' },
  expiring: { label: 'Истекает', tone: 'live' },
  expired: { label: 'Истекла', tone: 'cancelled' },
  none: { label: 'Нет категории', tone: 'draft' },
}

const coachColumns: Column<RegistryCoach>[] = [
  { key: 'name', header: 'Тренер', primary: true, cell: (row) => row.name },
  { key: 'municipality', header: 'Муниципалитет', hideBelow: 'lg', cell: (row) => row.municipality ?? '—' },
  {
    key: 'athletes',
    header: 'Спортсменов',
    align: 'right',
    cell: (row) => <span className="font-mono tabular-nums">{row.athletes}</span>,
  },
  {
    key: 'disciplines',
    header: 'Дисциплины',
    cell: (row) => <span className="text-sm">{row.disciplines.join(', ') || '—'}</span>,
  },
]

const judgeColumns: Column<RegistryJudge>[] = [
  { key: 'name', header: 'Судья', primary: true, cell: (row) => row.name },
  {
    key: 'category',
    header: 'Категория',
    cell: (row) => <span className="text-sm">{row.category ?? '—'}</span>,
  },
  {
    key: 'state',
    header: 'Срок',
    cell: (row) => (
      <span className="flex flex-col gap-0.5">
        <StatusTag tone={STATES[row.state].tone}>{STATES[row.state].label}</StatusTag>
        {row.valid_until && (
          <span className="font-mono text-xs text-muted tabular-nums">
            до {formatDate(`${row.valid_until}T12:00:00Z`)}
          </span>
        )}
      </span>
    ),
  },
  {
    key: 'assignments',
    header: 'Назначений за год',
    align: 'right',
    hideBelow: 'lg',
    cell: (row) => <span className="font-mono tabular-nums">{row.assignments}</span>,
  },
]

function Search() {
  const { get, change } = useRegistryParams()
  return (
    <Field label="Поиск">
      <Input
        type="search"
        leftIcon={<IconSearch size={18} />}
        placeholder="ФИО или почта"
        value={get('q')}
        onChange={(event) => change('q', event.target.value)}
      />
    </Field>
  )
}

/** Тренеры: число привязанных спортсменов и дисциплины связей */
export function CoachesTab() {
  const navigate = useNavigate()
  const { get, page, change, reset } = useRegistryParams()
  const municipalities = useDictionaryOptions('municipalities')
  const disciplines = useDictionaryOptions('disciplines')
  const query = {
    q: get('q') || undefined,
    municipality_id: toId(get('municipality')),
    discipline_id: toId(get('discipline')),
  }
  const list = useRegistryCoaches({ ...query, limit: PAGE, offset: (page - 1) * PAGE })
  const filtered = Boolean(get('q') || get('municipality') || get('discipline'))
  return (
    <div className="flex flex-col gap-5">
      <Toolbar
        className="lg:flex-wrap [&>div:first-child]:lg:basis-full [&>div:nth-child(2)]:lg:flex-wrap"
        search={<Search />}
        end={
          <>
            {filtered && (
              <Button variant="ghost" onClick={() => reset(['tab'])}>
                Сбросить
              </Button>
            )}
            <Button
              variant="secondary"
              leftIcon={<IconDownload size={18} />}
              href={registryApi.xlsx('coaches', query)}
            >
              Выгрузить xlsx
            </Button>
          </>
        }
      >
        <Field label="Дисциплина">
          <Select
            value={get('discipline')}
            onChange={(event) => change('discipline', event.target.value)}
            options={[
              { value: '', label: 'Все' },
              ...(disciplines.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        </Field>
        <Field label="Муниципалитет">
          <Select
            value={get('municipality')}
            onChange={(event) => change('municipality', event.target.value)}
            options={[
              { value: '', label: 'Все' },
              ...(municipalities.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        </Field>
      </Toolbar>
      <RegistryTable
        caption="Тренеры"
        columns={coachColumns}
        query={list}
        rowKey={(row) => row.id}
        page={page}
        onPage={(next) => change('page', next > 1 ? String(next) : '')}
        filtered={filtered}
        onReset={() => reset(['tab'])}
        onRowClick={(row) => navigate(routes.person(row.id))}
      />
    </div>
  )
}

/** Судьи: категория, срок её действия и нагрузка за год */
export function JudgesTab() {
  const navigate = useNavigate()
  const { get, page, change, reset } = useRegistryParams()
  const municipalities = useDictionaryOptions('municipalities')
  const query = {
    q: get('q') || undefined,
    municipality_id: toId(get('municipality')),
    state: get('state') || undefined,
  }
  const list = useRegistryJudges({ ...query, limit: PAGE, offset: (page - 1) * PAGE })
  const filtered = Boolean(get('q') || get('municipality') || get('state'))
  return (
    <div className="flex flex-col gap-5">
      <Toolbar
        className="lg:flex-wrap [&>div:first-child]:lg:basis-full [&>div:nth-child(2)]:lg:flex-wrap"
        search={<Search />}
        end={
          <>
            {filtered && (
              <Button variant="ghost" onClick={() => reset(['tab'])}>
                Сбросить
              </Button>
            )}
            <Button
              variant="secondary"
              leftIcon={<IconDownload size={18} />}
              href={registryApi.xlsx('judges', query)}
            >
              Выгрузить xlsx
            </Button>
          </>
        }
      >
        <Field label="Категория">
          <Select
            value={get('state')}
            onChange={(event) => change('state', event.target.value)}
            options={[
              { value: '', label: 'Все' },
              ...Object.entries(STATES).map(([value, item]) => ({ value, label: item.label })),
            ]}
          />
        </Field>
        <Field label="Муниципалитет">
          <Select
            value={get('municipality')}
            onChange={(event) => change('municipality', event.target.value)}
            options={[
              { value: '', label: 'Все' },
              ...(municipalities.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        </Field>
      </Toolbar>
      <RegistryTable
        caption="Судьи"
        columns={judgeColumns}
        query={list}
        rowKey={(row) => row.id}
        page={page}
        onPage={(next) => change('page', next > 1 ? String(next) : '')}
        filtered={filtered}
        onReset={() => reset(['tab'])}
        onRowClick={(row) => navigate(routes.person(row.id))}
      />
    </div>
  )
}
