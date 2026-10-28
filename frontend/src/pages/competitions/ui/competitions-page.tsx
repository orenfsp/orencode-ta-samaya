import { useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  CompetitionCard,
  useCompetitions,
  type CompetitionFilters,
  type CompetitionSort,
} from '@/entities/competition'
import { useDictionaryOptions, type DictionaryKey } from '@/entities/dictionary'
import { routes } from '@/shared/config'
import { plural } from '@/shared/lib'
import {
  Breadcrumbs,
  Button,
  Card,
  DateInput,
  Modal,
  EmptyState,
  ErrorState,
  Field,
  IconFilter,
  IconSearch,
  Input,
  Select,
  Skeleton,
  Switch,
  Tabs,
} from '@/shared/ui'

const STEP = 12

/** Порядок по умолчанию задаёт период (ближайшие — по возрастанию, прошедшие — свежие сверху) */
const sortOptions: { value: '' | CompetitionSort; label: string }[] = [
  { value: '', label: 'По дате' },
  { value: 'created_desc', label: 'Недавно добавленные' },
  { value: 'title', label: 'По названию' },
]
const FILTER_KEYS = [
  'discipline_id',
  'contest_level_id',
  'contest_format_id',
  'municipality_id',
  'age_group_id',
  'academic_group_id',
  'participation_type',
  'date_from',
  'date_to',
  'verified_only',
  'has_prize_fund',
]

const selects: { key: keyof CompetitionFilters; dictionary: DictionaryKey; label: string }[] = [
  { key: 'discipline_id', dictionary: 'disciplines', label: 'Дисциплина' },
  { key: 'contest_level_id', dictionary: 'contest_levels', label: 'Уровень' },
  { key: 'contest_format_id', dictionary: 'contest_formats', label: 'Формат' },
  { key: 'municipality_id', dictionary: 'municipalities', label: 'Муниципалитет' },
  { key: 'age_group_id', dictionary: 'age_groups', label: 'Возрастная группа' },
  { key: 'academic_group_id', dictionary: 'academic_groups', label: 'Академическая группа' },
]

function DictionaryFilter({
  dictionary,
  label,
  value,
  onChange,
}: {
  dictionary: DictionaryKey
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const options = useDictionaryOptions(dictionary)
  return (
    <Field label={label}>
      <Select
        value={value}
        disabled={options.isPending}
        onChange={(event) => onChange(event.target.value)}
        options={[
          { value: '', label: 'Все' },
          ...(options.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
        ]}
      />
    </Field>
  )
}

type Update = (values: Record<string, string>, replace?: boolean) => void

/** Фильтры каталога: на широком экране — колонка слева, на узком — в боковой панели */
function FiltersPanel({ value, update }: { value: (key: string) => string; update: Update }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Switch
          label="Только верифицированные ФСП"
          checked={value('verified_only') === '1'}
          onChange={(event) => update({ verified_only: event.target.checked ? '1' : '' })}
        />
        <Switch
          label="С призовым фондом"
          checked={value('has_prize_fund') === '1'}
          onChange={(event) => update({ has_prize_fund: event.target.checked ? '1' : '' })}
        />
      </div>
      <div className="h-px bg-line-soft" />
      {selects.map((item) => (
        <DictionaryFilter
          key={item.key}
          dictionary={item.dictionary}
          label={item.label}
          value={value(item.key)}
          onChange={(next) => update({ [item.key]: next })}
        />
      ))}
      <Field label="Участие">
        <Select
          value={value('participation_type')}
          onChange={(event) => update({ participation_type: event.target.value })}
          options={[
            { value: '', label: 'Любое' },
            { value: 'individual', label: 'Личное' },
            { value: 'team', label: 'Командное' },
          ]}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="С">
          <DateInput value={value('date_from')} onChange={(next) => update({ date_from: next })} />
        </Field>
        <Field label="По">
          <DateInput
            min={value('date_from') || undefined}
            value={value('date_to')}
            onChange={(next) => update({ date_to: next })}
          />
        </Field>
      </div>
    </div>
  )
}

/** Публичный каталог: фильтры живут в адресе, «Показать ещё» добирает следующую порцию */
export function CompetitionsPage() {
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const period = params.get('period') === 'past' ? 'past' : 'upcoming'
  const value = (key: string) => params.get(key) ?? ''
  const filters: CompetitionFilters = {
    period,
    search: value('search').slice(0, 300) || undefined,
    participation_type: value('participation_type') || undefined,
    verified_only: params.get('verified_only') === '1',
    has_prize_fund: params.get('has_prize_fund') === '1',
    date_from: value('date_from') || undefined,
    date_to: value('date_to') || undefined,
    sort: (sortOptions.find((option) => option.value === value('sort'))?.value || undefined) as
      CompetitionSort | undefined,
    ...Object.fromEntries(selects.map(({ key }) => [key, value(key) || undefined])),
  }
  const competitions = useCompetitions(filters, STEP)
  const activeCount = FILTER_KEYS.filter((key) => params.get(key)).length
  const filtered = activeCount > 0 || Boolean(value('search'))

  const update = (values: Record<string, string>, replace = false) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        Object.entries(values).forEach(([key, item]) => (item ? next.set(key, item) : next.delete(key)))
        return next
      },
      { replace },
    )
  }
  const reset = () => {
    setParams(
      Object.fromEntries(
        [
          ['period', period === 'past' ? period : ''],
          ['sort', value('sort')],
        ].filter(([, item]) => item),
      ),
    )
  }

  const items = competitions.data?.items ?? []
  const total = competitions.data?.total ?? 0

  return (
    <div className="container-page flex flex-col gap-8 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: 'Главная', to: routes.home }, { label: 'Соревнования' }]} />
      <header className="flex flex-col gap-3">
        <h1 className="text-h1 font-medium">Соревнования</h1>
        <p className="max-w-2xl text-lead text-muted">
          Турниры по спортивному программированию в регионе и онлайн. Верифицированные федерацией приносят
          баллы в рейтинг.
        </p>
      </header>

      {/* Верхняя строка: поиск, период, порядок; на узком экране — ещё кнопка «Фильтры» */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <Field label="Поиск по названию">
            <Input
              type="search"
              maxLength={300}
              placeholder="Название соревнования"
              leftIcon={<IconSearch size={18} />}
              value={value('search')}
              onChange={(event) => update({ search: event.target.value }, true)}
            />
          </Field>
        </div>
        {/* Телефон: период на всю ширину, ниже порядок и «Фильтры» в одну строку; шире — всё в ряд */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 md:flex">
          <Tabs
            aria-label="Период"
            value={period}
            fullWidth
            className="col-span-2 md:w-auto"
            onChange={(next) => update({ period: next === 'past' ? next : '' })}
            items={[
              { value: 'upcoming', label: 'Ближайшие' },
              { value: 'past', label: 'Прошедшие' },
            ]}
          />
          <Field label="Порядок" className="md:w-52">
            <Select
              value={value('sort')}
              options={sortOptions}
              onChange={(event) => update({ sort: event.target.value })}
            />
          </Field>
          <Button
            variant="secondary"
            className="lg:hidden"
            leftIcon={<IconFilter size={18} />}
            onClick={() => setFiltersOpen(true)}
          >
            Фильтры{activeCount > 0 && <span className="font-mono text-primary-text">{activeCount}</span>}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] 2xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside
          aria-label="Фильтры"
          className="hidden flex-col gap-5 rounded-xl border border-line-soft bg-surface p-5 lg:sticky lg:top-24 lg:flex"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-mono text-sm">Фильтры</h2>
            {activeCount > 0 && (
              <Button variant="text" size="sm" onClick={reset}>
                Сбросить
              </Button>
            )}
          </div>
          <FiltersPanel value={value} update={update} />
        </aside>

        <section
          className="flex flex-col gap-5"
          aria-label="Список соревнований"
          aria-busy={competitions.isFetching}
        >
          <div className="flex items-baseline gap-3">
            <h2 className="text-h3 font-medium">{period === 'past' ? 'Прошедшие' : 'Ближайшие'}</h2>
            {competitions.data && (
              <span className="font-mono text-sm text-muted">
                {total} {plural(total, ['соревнование', 'соревнования', 'соревнований'])}
              </span>
            )}
          </div>
          {competitions.isPending ? (
            <div className="grid gap-5 md:grid-cols-2">
              {[1, 2, 3].map((id) => (
                <Skeleton key={id} className="h-96 rounded-lg" />
              ))}
            </div>
          ) : competitions.isError ? (
            <ErrorState error={competitions.error} onRetry={() => competitions.refetch()} />
          ) : !items.length ? (
            <Card>
              <EmptyState
                title={
                  filtered
                    ? 'Ничего не нашлось'
                    : period === 'past'
                      ? 'Прошедших пока нет'
                      : 'Ближайших пока нет'
                }
                description={
                  filtered
                    ? 'Попробуйте ослабить фильтры'
                    : period === 'past'
                      ? 'Здесь появятся завершённые соревнования'
                      : 'Загляните в прошедшие или в календарь ФСП'
                }
                action={
                  filtered ? (
                    <Button variant="secondary" onClick={reset}>
                      Сбросить фильтры
                    </Button>
                  ) : (
                    <Button variant="secondary" to={routes.calendar}>
                      Открыть календарь
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <>
              <ul className="grid gap-5 md:grid-cols-2">
                {items.map((competition) => (
                  <li key={competition.id}>
                    <CompetitionCard competition={competition} />
                  </li>
                ))}
              </ul>
              {items.length < total && (
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant="secondary"
                    loading={competitions.isFetchingNextPage}
                    onClick={() => void competitions.fetchNextPage()}
                  >
                    Показать ещё
                  </Button>
                  <span className="font-mono text-sm text-muted">
                    {items.length} из {total}
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Modal
        size="md"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Фильтры"
        description={competitions.data ? `Найдено: ${total}` : undefined}
        footer={
          <>
            <Button variant="ghost" disabled={!activeCount} onClick={reset}>
              Сбросить
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Показать</Button>
          </>
        }
      >
        <FiltersPanel value={value} update={update} />
      </Modal>
    </div>
  )
}
