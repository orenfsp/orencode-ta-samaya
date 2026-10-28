import { useNavigate } from 'react-router'
import { useDictionaryOptions } from '@/entities/dictionary'
import { useOrganizationOptions } from '@/entities/organization'
import { registryApi, useRegistryAthletes, type RegistryAthlete } from '@/entities/registry'
import { stageTitles } from '@/entities/sport-profile'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import { Button, IconDownload, Field, IconSearch, Input, Select, Toolbar, type Column } from '@/shared/ui'
import { RegistryTable } from './registry-table'
import { PAGE, toId, useRegistryParams } from './use-params'

const NONE = 'none'
const KEYS = ['q', 'discipline', 'organization', 'municipality', 'age', 'rank', 'stage']

const columns: Column<RegistryAthlete>[] = [
  {
    key: 'name',
    header: 'Спортсмен',
    primary: true,
    cell: (row) => (
      <span className="flex min-w-0 flex-col">
        <span className="[overflow-wrap:anywhere]">{row.name}</span>
        <span className="text-xs text-muted">
          {formatDate(`${row.birth_date}T12:00:00Z`)} · {row.age_group ?? `${row.age} лет`}
        </span>
      </span>
    ),
  },
  {
    key: 'organization',
    header: 'Организация',
    cell: (row) =>
      row.organization?.name ?? (
        <span className="text-muted">{row.no_organization ? 'Без организации' : '—'}</span>
      ),
  },
  { key: 'municipality', header: 'Муниципалитет', hideBelow: 'lg', cell: (row) => row.municipality ?? '—' },
  {
    key: 'disciplines',
    header: 'Дисциплины',
    hideBelow: 'lg',
    cell: (row) => <span className="text-sm">{row.disciplines.join(', ') || '—'}</span>,
  },
  {
    key: 'rank',
    header: 'Разряд',
    cell: (row) =>
      row.rank ? (
        <span className="flex flex-col">
          <span className="text-sm">{row.rank}</span>
          {row.rank_valid_until && (
            <span className="font-mono text-xs text-muted tabular-nums">
              до {formatDate(`${row.rank_valid_until}T12:00:00Z`)}
            </span>
          )}
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: 'coaches',
    header: 'Тренеры',
    hideBelow: 'xl',
    cell: (row) => <span className="text-sm">{row.coaches.join(', ') || '—'}</span>,
  },
]

/** Спортсмены: дисциплина, организация, муниципалитет, возрастная группа, разряд, этап */
export function AthletesTab() {
  const navigate = useNavigate()
  const { get, page, change, reset } = useRegistryParams()
  const disciplines = useDictionaryOptions('disciplines')
  const municipalities = useDictionaryOptions('municipalities')
  const ages = useDictionaryOptions('age_groups')
  const ranks = useDictionaryOptions('rank_types')
  const organizations = useOrganizationOptions()
  const query = {
    q: get('q') || undefined,
    discipline_id: toId(get('discipline')),
    organization_id: get('organization') === NONE ? undefined : toId(get('organization')),
    no_organization: get('organization') === NONE || undefined,
    municipality_id: toId(get('municipality')),
    age_group_id: toId(get('age')),
    rank_type_id: get('rank') === NONE ? undefined : toId(get('rank')),
    without_rank: get('rank') === NONE || undefined,
    training_stage: get('stage') || undefined,
  }
  const list = useRegistryAthletes({ ...query, limit: PAGE, offset: (page - 1) * PAGE })
  const filtered = KEYS.some((key) => get(key))
  const options = (all: string, items: { id: number; name: string }[], none?: string) => [
    { value: '', label: all },
    ...(none ? [{ value: NONE, label: none }] : []),
    ...items.map((item) => ({ value: String(item.id), label: item.name })),
  ]

  return (
    <div className="flex flex-col gap-5">
      <Toolbar
        className="lg:flex-wrap [&>div:first-child]:lg:basis-full [&>div:nth-child(2)]:lg:flex-wrap"
        search={
          <Field label="Поиск">
            <Input
              type="search"
              leftIcon={<IconSearch size={18} />}
              placeholder="ФИО или почта"
              value={get('q')}
              onChange={(event) => change('q', event.target.value)}
            />
          </Field>
        }
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
              href={registryApi.xlsx('athletes', query)}
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
            options={options('Все', disciplines.data ?? [])}
          />
        </Field>
        <Field label="Организация">
          <Select
            value={get('organization')}
            onChange={(event) => change('organization', event.target.value)}
            options={options('Все', organizations.data?.items ?? [], 'Без организации')}
          />
        </Field>
        <Field label="Муниципалитет">
          <Select
            value={get('municipality')}
            onChange={(event) => change('municipality', event.target.value)}
            options={options('Все', municipalities.data ?? [])}
          />
        </Field>
        <Field label="Возрастная группа">
          <Select
            value={get('age')}
            onChange={(event) => change('age', event.target.value)}
            options={options('Все', ages.data ?? [])}
          />
        </Field>
        <Field label="Разряд">
          <Select
            value={get('rank')}
            onChange={(event) => change('rank', event.target.value)}
            options={options('Любой', ranks.data ?? [], 'Без разряда')}
          />
        </Field>
        <Field label="Этап">
          <Select
            value={get('stage')}
            onChange={(event) => change('stage', event.target.value)}
            options={[
              { value: '', label: 'Все' },
              ...Object.entries(stageTitles).map(([value, label]) => ({ value, label })),
            ]}
          />
        </Field>
      </Toolbar>
      <RegistryTable
        caption="Спортсмены"
        columns={columns}
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
