import { analyticsApi, useAnalytics } from '@/entities/analytics'
import { useDictionaryOptions } from '@/entities/dictionary'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import {
  Button,
  DateInput,
  Field,
  IconDownload,
  PageHeader,
  SearchSelect,
  Select,
  Skeleton,
  Tabs,
  Toolbar,
} from '@/shared/ui'
import { presets, useAnalyticsParams, type PeriodPreset } from '../model/params'
import {
  ApplicationsBlock,
  CoachesBlock,
  ContestsBlock,
  DemographicsBlock,
  DisciplinesBlock,
  JudgesBlock,
  ParticipantsBlock,
  QualificationsBlock,
  RetentionBlock,
  SummaryBlock,
} from './blocks'

/**
 * Аналитика федерации: одна страница, блоки подряд. Период и фильтры в адресе,
 * каждый показатель сравнивается с прошлым периодом той же длины. Любой блок — листом xlsx, всё — книгой.
 */
export function CabinetAnalyticsPage() {
  const { query, preset, values, update, filtered, reset } = useAnalyticsParams()
  const disciplines = useDictionaryOptions('disciplines')
  const municipalities = useDictionaryOptions('municipalities')
  const groups = useDictionaryOptions(query.group_kind === 'academic' ? 'academic_groups' : 'age_groups')
  // Точные даты периода и прошлого периода отдаёт бэк: у «Свои даты» без дат он подставляет год
  const summary = useAnalytics('summary', query)
  const period = summary.data

  const choosePreset = (next: PeriodPreset) =>
    update(
      next === 'custom'
        ? { period: next, from: period?.period.from ?? '', to: period?.period.to ?? '' }
        : { period: next === 'year' ? '' : next, from: '', to: '' },
    )

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <div className="flex flex-col gap-5">
        <PageHeader
          crumbs={[
            { label: 'Главная', to: routes.home },
            { label: 'Кабинет', to: routes.cabinetRole('federation') },
            { label: 'Аналитика' },
          ]}
          title="Аналитика"
          actions={
            <Button href={analyticsApi.xlsxUrl(query)} leftIcon={<IconDownload size={18} />}>
              Выгрузить всё
            </Button>
          }
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-4">
          <Tabs
            aria-label="Период"
            fullWidth
            className="sm:w-auto"
            value={preset}
            onChange={choosePreset}
            items={presets}
          />
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-3 sm:flex sm:[&>*]:w-44">
              <Field label="С">
                <DateInput value={values.from} onChange={(value) => update({ from: value })} />
              </Field>
              <Field label="По">
                <DateInput value={values.to} onChange={(value) => update({ to: value })} />
              </Field>
            </div>
          )}
          <div className="font-mono text-sm text-muted tabular-nums sm:ml-auto sm:self-center sm:text-right">
            {period ? (
              <>
                {formatDate(period.period.from)} — {formatDate(period.period.to)}
                <span className="block">
                  сравнение с {formatDate(period.previous.from)} — {formatDate(period.previous.to)}
                </span>
              </>
            ) : (
              <Skeleton className="h-10 w-56 rounded-sm" />
            )}
          </div>
        </div>

        <Toolbar
          end={
            filtered && (
              <Button variant="ghost" onClick={reset}>
                Сбросить
              </Button>
            )
          }
        >
          <Field label="Дисциплина">
            <SearchSelect
              value={query.discipline_id ?? ''}
              disabled={disciplines.isPending}
              onChange={(next) => update({ discipline_id: next })}
              options={[
                { value: '', label: 'Все дисциплины' },
                ...(disciplines.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
              ]}
            />
          </Field>
          <Field label="Муниципалитет">
            <SearchSelect
              value={query.municipality_id ?? ''}
              disabled={municipalities.isPending}
              onChange={(next) => update({ municipality_id: next })}
              options={[
                { value: '', label: 'Вся область' },
                ...(municipalities.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
              ]}
            />
          </Field>
          <Field label="Вид группы">
            <Select
              value={query.group_kind ?? ''}
              onChange={(event) => update({ group_kind: event.target.value, group_id: '' })}
              options={[
                { value: '', label: 'Все группы' },
                { value: 'age', label: 'Возрастные' },
                { value: 'academic', label: 'Академические' },
              ]}
            />
          </Field>
          <Field label="Группа">
            <Select
              value={query.group_id ?? ''}
              disabled={!query.group_kind || groups.isPending}
              onChange={(event) => update({ group_id: event.target.value })}
              options={[
                { value: '', label: query.group_kind ? 'Любая' : 'Сначала вид' },
                ...(query.group_kind ? (groups.data ?? []) : []).map((item) => ({
                  value: String(item.id),
                  label: item.name,
                })),
              ]}
            />
          </Field>
        </Toolbar>
      </div>

      <SummaryBlock query={query} />
      <ParticipantsBlock query={query} />
      <ContestsBlock query={query} />
      <ApplicationsBlock query={query} />
      <RetentionBlock query={query} />
      <DemographicsBlock query={query} />
      <CoachesBlock query={query} />
      <JudgesBlock query={query} />
      <QualificationsBlock query={query} />
      <DisciplinesBlock query={query} />
    </div>
  )
}
